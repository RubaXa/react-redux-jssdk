import {func} from 'prop-types';
import {connect as reactReduxConnect, Connect} from 'react-redux';
import {debounce, F_NO_ARGS} from '@perf-tools/balancer';

const NS = '__react-redux-jssdk__';

let Class: ObservableClass = null;

export function setObservableClass(Target) {
	Class = Target;
}

interface ObservableClass {
	prototype: {
		__beforeGet__: (model: Observable) => void;
	};
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

function proxyCell(cmp) {
	const models = [];
	const activeList = {};
	const handleEvent = debounce(cmp.forceUpdate, cmp, null, {flags: F_NO_ARGS});
	let __beforeGet__;
	let rev = 0;
	let length = 0;


	function autobind(model) {
		if (activeList[model.cid] === void 0) {
			model.on(getEventNames(model), handleEvent);
			models[length++] = model;
		}

		activeList[model.cid] = rev;
	}

	return function (render, ctx, props, context) {
		let newLength = 0;

		rev++;
		__beforeGet__ = Class.prototype.__beforeGet__;
		Class.prototype.__beforeGet__ = autobind;

		const frag = render.call(ctx, props, context);

		for (let i = 0; i < length; i++) {
			const model = models[i];
			models[newLength] = model;

			if (activeList[model.cid] === rev) {
				newLength++;
			} else {
				model.off(getEventNames(model), handleEvent);
				activeList[model.cid] = void 0;
			}
		}

		length = newLength;
		Class.prototype.__beforeGet__ = __beforeGet__;

		return frag;
	};
}

function computed(render) {
	return function computedRender(props, context) {
		return context[NS](render, this, props, context);
	};
}

export default <Connect>function connect(...args) {
	return function (Target) {
		if (typeof Target === 'function') {
			Target = computed(Target);
		} else {
			Target.prototype.render = computed(Target.prototype.render);
		}

		const HOC = reactReduxConnect(...args)(Target);
		const proto = HOC.prototype;
		const {getChildContext} = proto;

		HOC.childContextTypes = {
			...Object(HOC.childContextTypes),
			[NS]: func,
		};

		Target.contextTypes = {
			...Object(Target.childContextTypes),
			[NS]: func,
		};

		proto[NS] = null;
		proto.getChildContext = function () {
			const context = getChildContext ? getChildContext.call(this) : {};

			if (this[NS] === null) {
				this[NS] = proxyCell(this);
			}

			context[NS] = this[NS];
			return context;
		};

		return HOC;
	};
};
