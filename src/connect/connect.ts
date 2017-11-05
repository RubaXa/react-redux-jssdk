import {connect as reactReduxConnect, Connect} from 'react-redux';
import {debounce, F_NO_ARGS} from '@perf-tools/balancer';

interface Wrapper {
	selector: {props: object};

	__models__: Set<Observable>;
	__forceUpdate__: () => void;

	forceUpdate(): void;
	componentDidMount(): void;
	componentWillUnmount(): void;
	componentWillReceiveProps(nextProps: object): void;
}

interface Observable {
	on: Function;
	off: Function;
	forEach: Function;
}

function isObservable(value): value is Observable {
	return value && typeof value.on === 'function' && typeof value.off === 'function';
}

function getEventNames(model: Observable) {
	return typeof model.forEach === 'function' ? 'add remove sort reset update' : 'change';
}

function updateModels(cmp: Wrapper) {
	const props = cmp.selector.props;
	const {
		__models__ = new Set<Observable>(),
		__forceUpdate__,
	} = cmp;
	const newModels = Object.keys(props).reduce((models, name) => {
		const model = props[name];

		if (isObservable(model) && !models.has(model)) {
			!__models__.has(model) && model.on(getEventNames(model), __forceUpdate__);
			models.add(model);
		}

		return models;
	}, new Set<Observable>());

	__models__.forEach(model => {
		if (!newModels.has(model)) {
			model.off(getEventNames(model), __forceUpdate__);
		}
	});

	cmp.__models__ = newModels;
}

export default <Connect>function connect(...args) {
	return function (Target) {
		const HOC = reactReduxConnect(...args)(Target);
		const proto = HOC.prototype;
		const {
			componentDidMount,
			componentWillUnmount,
			onStateChange,
		} = proto;

		proto.componentDidMount = function () {
			this.__forceUpdate__ = debounce(this.forceUpdate, this, null, {flags: F_NO_ARGS});
			updateModels(this);
			componentDidMount && componentDidMount.call(this);
		};

		proto.onStateChange = function () {
			onStateChange && onStateChange.call(this);
			updateModels(this);
		};

		proto.componentWillUnmount = function () {
			this.__forceUpdate__.cancel();
			updateModels(this);
			componentWillUnmount && componentWillUnmount.call(this);
		};

		return HOC;
	};
};
