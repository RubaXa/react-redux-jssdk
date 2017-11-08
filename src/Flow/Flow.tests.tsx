import * as React from 'react';
import * as ReactDOM from 'react-dom';
import Flow from './Flow';
import {FlowProps} from '../createFlow/createFlow';

function Loading() {
	return <i>Loading...</i>;
}

function Failed({error}: FlowProps) {
	return <b>{error.toString()}</b>;
}

function pause(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

it('Flow', async () => {
	let flow: FlowProps = {pending: true, success: false, failed: false, error: null};
	const root = document.createElement('div');
	const render = (destroy?) => {
		ReactDOM.render(
			destroy ? null : <Flow
				source={flow}
				pending={<Loading/>}
				failed={<Failed/>}
				pendingDelayBeforeShow={10}
				pendingDelayBeforeHide={10}
			>OK</Flow>,
			root,
		);

		return root.innerHTML;
	};

	expect(render()).toEqual('<i>Loading...</i>');

	flow = {...flow, pending: false, success: true};
	expect(render()).toEqual('<i>Loading...</i>');

	await pause(15);
	expect(render()).toEqual('OK');

	flow = {...flow, pending: true};
	expect(render()).toEqual('OK');
	await pause(5);

	flow = {...flow, pending: false, failed: true, error: new Error('xhr')};
	expect(render()).toEqual('<b>Error: xhr</b>');

	flow = {...flow, pending: true};
	expect(render(true)).toEqual('');

	await pause(20);
});


it('Flow / ChildrenFactory', async () => {
	let flow: FlowProps = {pending: false, success: true};
	const root = document.createElement('div');
	const render = () => {
		ReactDOM.render(
			<Flow source={flow}>{() => <b>Done</b>}</Flow>,
			root,
		);

		return root.innerHTML;
	};

	expect(render()).toEqual('<b>Done</b>');
});

