import {combineReducers, createStore} from 'redux';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {connect, setObservableClass} from './connect';
import {Provider} from 'react-redux';
import {requestFrame} from '@perf-tools/balancer';

let cid = 1;

class Emitter {
	__beforeGet__: (model: Emitter) => void;
	cid: number;
	forEach: () => void;
	list = [];

	constructor(private value: string) {
		this.cid = cid++;
	}

	on(name, fn) {
		this.list.push(fn);
	}

	off(name, fn) {
		this.list.splice(this.list.indexOf(fn), 1);
	}

	set(value, silent?) {
		this.value = value;
		!silent && this.list.forEach(fn => fn());
		return this;
	}

	get() {
		(this.__beforeGet__ !== null) && this.__beforeGet__(this);
		return this.value;
	}
}

Emitter.prototype.__beforeGet__ = null;

async function frame() {
	return new Promise(resolve => {
		requestFrame(resolve);
	});
}

const defaultFolder = new Emitter('inbox');
const defaultThreads = new Emitter('3');
defaultThreads.forEach = () => {};

setObservableClass(Emitter);

type TestState = {
	active: string;
	folder: string;
	threads: {get(): string};
};

const store = createStore<TestState>(combineReducers<TestState>({
	active: (state = 0, {type, payload}) => type == 'ACTIVE' ? payload : state,
	folder: (folder = defaultFolder, {type, payload}) => {
		switch (type) {
			case 'FOLDER/SET': return payload;
			case 'FOLDER/CHANGE': return folder.set(payload);
		}
		return folder;
	},
	threads: (threads = defaultThreads, {type, payload}) => {
		switch (type) {
			case 'THREADS/SET': return payload;
			case 'THREADS/CHANGE': return threads.set(payload);
		}
		return threads;
	},
}));

describe('connect: mapStateToProps', () => {
	beforeEach(() => {
		defaultFolder.set('inbox');
		store.dispatch({type: 'ACTIVE', payload: 0});
		store.dispatch({type: 'FOLDER/SET', payload: defaultFolder});
		store.dispatch({type: 'THREADS/SET', payload: defaultThreads});
	});

	const root = document.createElement('div');
	const Fragment = connect<TestState>((store) => ({
		active: store.active,
		folder: store.folder.get(),
		threads: store.threads,
	}))(({active, folder, threads}) => [
		`active: ${active}`,
		`folder: ${folder}`,
		`threads: ${threads.get()}`,
	].join('\n') as any);

	ReactDOM.render(
		<Provider store={store}>
			<Fragment/>
		</Provider>,
		root,
	);

	it('initial', () => {
		expect(root.innerHTML.split('\n')).toEqual([
			'active: 0',
			'folder: inbox',
			'threads: 3',
		]);
	});

	it('active', () => {
		store.dispatch({type: 'ACTIVE', payload: 950});
		expect(root.innerHTML.split('\n')[0]).toEqual('active: 950');
	});

	it('folder/change', async () => {
		store.dispatch({type: 'FOLDER/CHANGE', payload: 'spam'});
		await frame();
		expect(root.innerHTML.split('\n')[1]).toEqual('folder: spam');
	});

	it('folder/set', async () => {
		const folder = new Emitter('trash');

		store.dispatch({type: 'FOLDER/SET', payload: folder});
		await frame();
		expect(root.innerHTML.split('\n')[1]).toEqual('folder: trash');

		defaultFolder.set('fail');
		folder.set('archive', true);

		await frame();
		expect(root.innerHTML.split('\n')[1]).toEqual('folder: trash');

		folder.set('archive');
		await frame();
		expect(root.innerHTML.split('\n')[1]).toEqual('folder: archive');

		defaultFolder.set('revert');
		store.dispatch({type: 'FOLDER/SET', payload: defaultFolder});
		await frame();
		expect(root.innerHTML.split('\n')[1]).toEqual('folder: revert');

		store.dispatch({type: 'FOLDER/SET', payload: defaultFolder});
		await frame();
		defaultFolder.set('revert-fail', true);
		folder.set('ping');
		await frame();
		expect(root.innerHTML.split('\n')[1]).toEqual('folder: revert');
	});

	it('folder#set', async () => {
		defaultFolder.set('drafts');
		await frame();
		expect(root.innerHTML.split('\n')[1]).toEqual('folder: drafts');
	});

	it('threads#set', async () => {
		defaultThreads.set('123');
		await frame();
		expect(root.innerHTML.split('\n')[2]).toEqual('threads: 123');
	});
});

describe('connect: mapDispatchToProps', () => {
	const root = document.createElement('div');
	const Fragment = connect<TestState, {action: () => string}>(null, () => ({action: () => 'OK'}))(({action}) => [
		`action: ${action()}`,
	].join('\n') as any);

	ReactDOM.render(
		<Provider store={store}>
			<Fragment/>
		</Provider>,
		root,
	);

	it('initial', () => {
		expect(root.innerHTML.split('\n')).toEqual([
			'action: OK',
		]);
	});
});
