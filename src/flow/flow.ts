import * as React from 'react';
import {FlowProps} from '../createFlow/createFlow';

export type ChildrenFactory = () => React.ReactNode;
export type Props = {
	source: FlowProps;
	pending?: React.ReactNode;
	failed?: React.ReactNode;
	children?: string | React.ReactNode | ChildrenFactory;
	pendingDelayBeforeShow?: number;
	pendingDelayBeforeHide?: number;
};

export type State = {
	pending: boolean;
};

export class FlowError extends React.Component<FlowProps, null> {
	render() {
		const {error} = this.props;

		return React.createElement(
			'div',
			{
				style: {
					fontFamily: 'Arial',
					fontSize: 11,
					fontWeight: 'normal',
					color: '#fff',
					padding: '2px 5px',
					background: 'red',
				}
			},
			error ? error.toString() : 'FlowError',
		);
	}
}

export default class Flow extends React.Component<Props, State> {
	static defaultProps = {
		pendingDelayBeforeShow: 100,
		pendingDelayBeforeHide: 50,
	};

	private pid: number;

	constructor(props, context) {
		super(props, context);

		this.state = {
			pending: props.pending,
		};
	}

	componentWillReceiveProps(nextProps) {
		const {pending} = nextProps.source;

		if (this.props.source.pending !== pending) {
			clearTimeout(this.pid);
			this.pid = window.setTimeout(() => {
				this.setState({pending});
			}, this.props[pending ? 'pendingDelayBeforeShow' : 'pendingDelayBeforeHide']);
		}
	}

	componentWillUnmount() {
		clearTimeout(this.pid);
	}

	render() {
		const {
			source,
			pending,
			failed = React.createElement(FlowError, source),
			children,
		} = this.props;
		let fragment = null;

		if (this.state.pending && pending) {
			fragment = pending;
		} else if (source.failed && failed) {
			fragment = failed;
		} else if (source.success && children) {
			switch (typeof children) {
				case 'function': return (children as ChildrenFactory)();
				default: return children;
			}
		}

		return fragment === null
			? fragment
			: React.cloneElement(React.Children.only(fragment), source)
		;
	}
}
