import {Middleware, MiddlewareAPI, Reducer} from 'redux';

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

export type FlowEffect<StateProps extends FlowProps, S> = (action: Action, api: MiddlewareAPI<S>) => Promise<Partial<StateProps>>;

export type FlowScheme<StateProps extends FlowProps, S> = {
	name: string;
	defaults: StateProps;
	effects?: FlowEffect<StateProps, S> | {
		[actionType: string]: FlowEffect<StateProps, S>;
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

		middleware: ((api: MiddlewareAPI<State>) => {
			const {dispatch} = api;
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

				if (ACTIONS.PENDING === type || ACTIONS.SUCCESS === type || ACTIONS.FAILED === type) {
					return;
				}

				if (isFunction) {
					promise = (effects as FlowEffect<StateProps, State>)(action, api);
				} else if (effects.hasOwnProperty(type)) {
					promise = effects[type](action, api);
				}

				if (promise != null) {
					dispatch(PENDING);

					promise
						.then(factoryResolver(type, 'SUCCESS'))
						.catch(factoryResolver(type, 'FAILED'))
					;
				}
			};
		}) as Middleware,

		reducer: ((state: StateProps = INITIAL_STATE, action: Action) => {
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
		}) as Reducer<StateProps>,
	};
}
