import {func} from 'prop-types';
import {connect as reactReduxConnect, Connect} from 'react-redux';
import {debounce, F_NO_ARGS} from '@perf-tools/balancer';

const NS_RUN = '__react-redux-jssdk__#run';
const NS_RENDER = '__react-redux-jssdk__#render';

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

function proxyCell(cmp, isSelector?: boolean) {
	const models = [];
	const activeList = {};

	const forceUpdate = debounce(() => {
		isSelector && cmp.selector.run(cmp.props);
		cmp.forceUpdate();
	}, cmp, null, {flags: F_NO_ARGS});

	const handleEvent = () => {
		if (cmp.selector.interactive) {
			cmp.selector.shouldComponentUpdate = true;
		} else {
			forceUpdate();
		}
	};

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

	return function (render, ctx, args) {
		let newLength = 0;

		rev++;
		__beforeGet__ = Class.prototype.__beforeGet__;
		Class.prototype.__beforeGet__ = autobind;

		const frag = render.apply(ctx, args);

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

function computed(render, stateless?: boolean) {
	return function computedRender(...args) {
		if (stateless) {
			return args[1][NS_RENDER](render, this, args);
		} else {
			return this.context[NS_RENDER](render, this, args);
		}
	};
}

function cloneClass(Target) {
	const CloneTarget = function (props, context) { Target.call(this, props, context); };
	CloneTarget.prototype = Object.create(Target.prototype);
	CloneTarget.prototype.constructor = CloneTarget;
	return CloneTarget;
}

export const connect: Connect = (function connect(...args) {
	const [
		mapStateToProps,
		mapDispatchToProps,
	] = args;

	return function (Target) {
		if (Target && Target.prototype && Target.prototype.render) {
			Target = cloneClass(Target);
			Target.prototype.render = computed(Target.prototype.render);
		} else {
			Target = computed(Target, true);
		}

		const HOC = (reactReduxConnect as Function)(...args)(Target);
		const proto = HOC.prototype;
		const {
			getChildContext,
		} = proto;

		HOC.childContextTypes = {
			...Object(HOC.childContextTypes),
			[NS_RENDER]: func,
		};

		Target.contextTypes = {
			...Object(Target.childContextTypes),
			[NS_RENDER]: func,
		};

		proto[NS_RUN] = null;
		proto[NS_RENDER] = null;

		proto.initSelector = function () {
			this[NS_RUN] = proxyCell(this, true);
			this[NS_RENDER] = proxyCell(this);

			this.selector = {
				interactive: false,
				error: null,
				props: {},
				run: (ownProps) => {
					const {selector} = this;

					if (selector.interactive) {
						return;
					}

					selector.interactive = true;

					const newProps = mapStateToProps ? this[NS_RUN](mapStateToProps, null, [this.store.getState(), ownProps]) : {};
					const oldProps = selector.props;

					if (mapDispatchToProps) {
						const disProps = mapDispatchToProps(this.store.dispatch, ownProps);
						disProps && Object.assign(newProps, disProps);
					}

					for (const key in ownProps) {
						if (!newProps.hasOwnProperty(key)) {
							newProps[key] = ownProps[key];
						}
					}

					selector.interactive = false;
					selector.props = newProps;
					selector.shouldComponentUpdate = false;

					if (oldProps !== newProps) {
						for (const key in newProps) {
							if (newProps[key] !== oldProps[key]) {
								selector.shouldComponentUpdate = true;
								return;
							}
						}
					}
				}
			};

			this.selector.run(this.props);
		};

		proto.getChildContext = function () {
			const context = getChildContext ? getChildContext.call(this) : {};
			context[NS_RENDER] = this[NS_RENDER];
			return context;
		};

		return HOC;
	};
}) as any;
