import {Dispatch, Middleware, MiddlewareAPI} from 'redux';

export interface Action {
	type: string;
	payload: any;
}

export interface FlowProps {
	pending?: boolean;
	success?: boolean;
	failed?: boolean;
	error?: Error;
}

export type FlowEffect<StateProps extends FlowProps, State> = (action: Action, dispatch: Dispatch<State>, geState: () => State) => Promise<Partial<StateProps>>;

export type FlowScheme<StateProps extends FlowProps, State> = {
	name: string;
	defaults: StateProps;
	effects?: FlowEffect<StateProps, State> | {
		[actionType: string]: FlowEffect<StateProps, State>;
	};
	reducer?: (state: StateProps, action: Action) => StateProps;
};


export function createFlow<StateProps extends FlowProps, State>(scheme: FlowScheme<StateProps, State>) {
	const {
		name,
		reducer,
		effects,
		defaults,
	} = scheme;

	const ACTIONS = {
		INIT: `${name}/INIT`,
		PENDING: `${name}/PENDING`,
		SUCCESS: `${name}/SUCCESS`,
		FAILED: `${name}/FAILED`,
	};

	const PENDING = {type: ACTIONS.PENDING, payload: name};
	const INITIAL_STATE = {
		...Object(defaults),
		pending: false,
		success: false,
		failed: false,
		error: null,
	} as StateProps;

	return {
		name,
		ACTIONS,

		middleware: (({dispatch, getState}: MiddlewareAPI<State>) => {
			let cid = 0;
			let isFunction = typeof effects === 'function';
			let activeEffects: {[name: string]: number} = {};

			function factoryResolver(actionType, resolveAs) {
				const id = ++cid;
				const key = `${actionType}${resolveAs}`;

				activeEffects[key] = id;

				return (result) => {
					if (activeEffects[key] === id) {
						dispatch({type: ACTIONS[resolveAs], payload: result});
					}
				};
			}

			return (next) => (action: Action) => {
				next(action);

				const type = action.type;
				let promise = null;

				if (isFunction) {
					promise = (effects as FlowEffect<StateProps, State>)(action, dispatch, getState);
					(promise != null) && dispatch(PENDING);
				} else if (effects.hasOwnProperty(type)) {
					dispatch(PENDING);
					promise = effects[type](action, dispatch, getState);
				}

				if (promise != null) {
					promise
						.then(factoryResolver(type, 'SUCCESS'))
						.catch(factoryResolver(type, 'FAILED'))
					;
				}
			};
		}) as Middleware,

		reducer: (state: StateProps = INITIAL_STATE, action: Action) => {
			const {type, payload} = action;

			switch (type) {
				case ACTIONS.PENDING:
					state = {
						...Object(state),
						pending: true,
					};
					break;

				case ACTIONS.SUCCESS:
					state = {
						...Object(state),
						...Object(payload),
						pending: false,
						success: true,
						failed: false,
						error: null,
					};
					break;

				case ACTIONS.FAILED:
					state = {
						...Object(state),
						pending: false,
						success: false,
						failed: true,
						error: payload,
					};
					break;
			}

			return reducer ? reducer(state, action) : state;
		},
	};
}
