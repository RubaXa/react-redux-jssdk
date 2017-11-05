import * as React from 'react';
import {FlowProps} from '../createFlow/createFlow';

export type Props = {
	source: FlowProps;
	pending?: React.ReactNode;
	failed?: React.ReactNode;
	children?: string | React.ReactNode;
	pendingDelayBeforeShow?: number;
	pendingDelayBeforeHide?: number;
};

export type State = {
	pending: boolean;
};

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
			failed,
			children,
		} = this.props;
		let fragment = null;

		if (this.state.pending && pending) {
			fragment = pending;
		} else if (source.failed && failed) {
			fragment = failed;
		} else if (source.success && children) {
			fragment = children;

			if (typeof fragment === 'string') {
				return fragment;
			}
		}

		return fragment === null
			? fragment
			: React.cloneElement(React.Children.only(fragment), source)
		;
	}
}
