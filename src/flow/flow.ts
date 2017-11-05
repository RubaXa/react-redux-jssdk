import {Dispatch} from 'redux';

export interface Action {
	type: string;
	payload: any;
}

export interface FlowProps {
	pending: boolean;
	success: boolean;
	failed: boolean;
	error: Error;
}

export type FlowEffect<TStateProps, TState> = (action: Action, dispatch: Dispatch<TState>, getState: () => TState) => Promise<Partial<TStateProps>>;

export type FlowScheme<TStateProps, TState> = {
	name: string;
	effects: FlowEffect<TStateProps, TState> | {
		[actionType: string]: FlowEffect<TStateProps, TState>;
	};
	reducer: (state: TStateProps, action: Action) => TStateProps;
};

export function createFlow<TStateProps, TState = any>(scheme: FlowScheme<TStateProps, TState>) {
	const {
		name,
		reducer,
		effects,
	} = scheme;

	const ACTIONS = {
		INIT: `${name}/INIT`,
		PENDING: `${name}/PENDING`,
		SUCCESS: `${name}/SUCCESS`,
		FAILED: `${name}/FAILED`,
	};

	const PENDING = {type: ACTIONS.PENDING, payload: name};

	return {
		ACTIONS,

		middleware: ({dispatch, getState}) => {
			let cid = 0;
			let inited = false;
			let isPureEffects = typeof effects === 'function';
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

				if (inited) {
					const type = action.type;
					let promise = null;

					dispatch(PENDING);

					if (isPureEffects) {
						promise = (effects as FlowEffect<TStateProps, TState>)(action, dispatch, getState);
					} else if (effects.hasOwnProperty(type)) {
						promise = effects[type](action, dispatch, getState);
					}

					if (promise !== null) {
						promise
							.then(factoryResolver(type, 'SUCCESS'))
							.catch(factoryResolver(type, 'FAILED'))
						;
					}
				} else {
					inited = true;
					dispatch({type: ACTIONS.INIT, payload: name});
				}
			};
		},

		reducer: (state: TStateProps & FlowProps, action: Action) => {
			const {type, payload} = action;

			if (type === ACTIONS.PENDING || type === ACTIONS.SUCCESS || type === ACTIONS.FAILED) {
				state = {
					...Object(state),
					pending: type === ACTIONS.PENDING,
					success: false,
					failed: false,
					error: null,
				};

				if (type === ACTIONS.SUCCESS) {
					state.success = true;
					Object.assign(state, payload);
				} else if (type === ACTIONS.FAILED){
					state.failed = true;
					state.error = payload;
				}
			}

			return reducer(state, action);
		},
	};
}
