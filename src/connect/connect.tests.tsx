import {combineReducers, createStore} from 'redux';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import connect from './connect';
import {Provider} from 'react-redux';
import {requestFrame} from '@perf-tools/balancer';

let cid = 1;

class Emitter {
	cid: number;
	forEach: () => void;
	list = [];

	constructor(public value: string) {
		this.cid = cid++;
	}

	on(name, fn) {
		this.list.push(fn);
	}

	off(name, fn) {
		this.list.splice(this.list.indexOf(fn), 1);
	}

	set(value) {
		this.value = value;
		this.list.forEach(fn => fn());
		return this;
	}
}

async function frame() {
	return new Promise(resolve => {
		requestFrame(resolve);
	});
}


const defaultFolder = new Emitter('inbox');
const defaultThreads = new Emitter('3');
defaultThreads.forEach = () => {};

const store = createStore(combineReducers({
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

describe('connect', () => {
	beforeEach(() => {
		defaultFolder.set('inbox');
		store.dispatch({type: 'ACTIVE', payload: 0});
		store.dispatch({type: 'FOLDER/SET', payload: defaultFolder});
		store.dispatch({type: 'THREADS/SET', payload: defaultThreads});
	});

	const root = document.createElement('div');
	const Fragment = connect<{
		active: string;
		folder: {value: string};
		threads: {value: string};
	}>((strore) => strore)(({active, folder, threads}) => [
		`active: ${active}`,
		`folder: ${folder.value}`,
		`threads: ${threads.value}`,
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
		folder.value = 'archive';

		await frame();
		expect(root.innerHTML.split('\n')[1]).toEqual('folder: trash');

		folder.set('archive');
		await frame();
		expect(root.innerHTML.split('\n')[1]).toEqual('folder: archive');
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