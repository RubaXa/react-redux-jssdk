import {createFlow, FlowProps} from './createFlow';
import {createStore, combineReducers, applyMiddleware} from 'redux';
import {requestFrame} from '@perf-tools/balancer';

interface SearchStateProps extends FlowProps {
	count: number;
}

interface Store {
	search: SearchStateProps;
}

async function frame() {
	return new Promise(resolve => {
		requestFrame(resolve);
	});
}

it('createFlow / object', async () => {
	const SOMETHING_HAS_CHANGED_SUCCESS = 'SOMETHING_HAS_CHANGED_SUCCESS';
	const SOMETHING_HAS_CHANGED_FAILED = 'SOMETHING_HAS_CHANGED_FAILED';
	let num = 10;

	const fixture = (extra) => ({
		count: 0,
		error: null,
		failed: false,
		pending: false,
		success: false,
		...extra,
	});

	const flow = createFlow<SearchStateProps, Store>({
		name: '~SEARCH',
		defaults: {count: 0},
		effects: {
			[SOMETHING_HAS_CHANGED_SUCCESS]: ({payload: delay}) => new Promise(resolve => {
				const state = {count: num++};
				setTimeout(() => {
					resolve(state);
				}, delay|0);
			}),
			[SOMETHING_HAS_CHANGED_FAILED]: () => Promise.reject(new Error('xhr')),
		},
		reducer: (state) => state,
	});

	const store = createStore<Store>(
		combineReducers({search: flow.reducer}),
		applyMiddleware(flow.middleware),
	);

	expect(store.getState().search).toEqual(fixture({}));

	store.dispatch({type: SOMETHING_HAS_CHANGED_SUCCESS});
	expect(store.getState().search).toEqual(fixture({pending: true}));

	await frame();
	expect(store.getState().search).toEqual(fixture({count: 10, success: true}));

	store.dispatch({type: SOMETHING_HAS_CHANGED_FAILED});
	expect(store.getState().search).toEqual(fixture({count: 10, pending: true, success: true}));

	await frame();
	expect(store.getState().search).toEqual(fixture({count: 10, failed: true, error: new Error('xhr')}));

	store.dispatch({type: SOMETHING_HAS_CHANGED_SUCCESS, payload: 5});
	store.dispatch({type: SOMETHING_HAS_CHANGED_SUCCESS, payload: 1});

	await frame();
	expect(store.getState().search).toEqual(fixture({count: 12, success: true}));
});

it('createFlow / function', async () => {
	const SOMETHING_HAS_CHANGED_SUCCESS = 'SOMETHING_HAS_CHANGED_SUCCESS';
	const SOMETHING_HAS_CHANGED_FAILED = 'SOMETHING_HAS_CHANGED_FAILED';

	const flow = createFlow<SearchStateProps, Store>({
		name: '~SEARCH',
		defaults: {count: 0},
		effects: ({type}) => {
			if (type === SOMETHING_HAS_CHANGED_SUCCESS) {
				return Promise.resolve({count: 10})
			} else if (type === SOMETHING_HAS_CHANGED_FAILED) {
				return Promise.reject(new Error('xhr'));
			}
		},
		reducer: (state) => state,
	});

	const store = createStore<Store>(
		combineReducers({search: flow.reducer}),
		applyMiddleware(flow.middleware),
	);

	store.dispatch({type: SOMETHING_HAS_CHANGED_SUCCESS});
	expect(store.getState().search.pending).toBe(true);

	await frame();
	expect(store.getState().search.success).toEqual(true);
	expect(store.getState().search.count).toEqual(10);

	store.dispatch({type: SOMETHING_HAS_CHANGED_FAILED});
	await frame();
	expect(store.getState().search.failed).toEqual(true);
});
