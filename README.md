React-Redux-JSSDK
-----------------
Работа с JSSDK поверх Redux, плюс высякие хелперы.

```
npm i --save react-redux-jssdk
```

### API

 - [connect](#connect) — коннектор для redux и jssdk
 - [createFlow](#createFlow) — упрощаем работу с асинхронными данымми
 - [<Flow/>](#Flow) — компонент для удобной работы с «потоком»

---

### Usage

##### store.ts
```tsx
import Filter from 'mail/Filter';
import {combineReducers, createStore} from 'redux';
import {createFlow, FlowProps} from 'react-jssdk';

export interface FilterStateProps {
	id: number;
	// ...
}

export interface UIStateProps {
	detail: boolean;
}

export interface FilterResultsStateProps extends FlowProps {
	count: number;
}

export interface AppStore {
	filter: FilterStateProps;
	ui: UIStateProps;
	filterResults: FilterResultsStateProps;
}

// «Поток» получения количества писем подходящих под условия фильтрации
const filterResults = createFlow<FilterResultsStateProps, AppStore>({
	name: 'FILTER/RESULTS',
	defaults: {count: 0},
	effects: {
		'FILTER/CONDITIONS': ({payload}) => RPC.call('filters/check', payload).then(req => ({count: req.get('body')})),
	},
	reducer: state => state,
});

// Общий список всех редьюсеров
const reducers = {
	// Работа с моделью
	filter(model = new Filter, {type, payload}) {
		switch (type) {
			// Установка модели для редактирования
			case 'FILTER/SET':
				model = payload;
				break;

			// Изменение условий фильтрации
			case 'FILTER/CONDITIONS':
				payload = {conditions: payload};
				/*fallthrough*/

			// Изменение свойств модели
			case 'FILTER/UPDATE':
				model.set(payload);
				break;
		}

		return model;
	},

	// Всяки флаги UI
	ui(state = {detail: false}, {payload}) {
		switch (type) {
			case 'ui/detail/toggle':
				state = {...state, detail: !state.detail};
				break;
		}
		return state;
	},

	// Редьюсер «потока»
	filterResults: filterResults.reducer,
};

// Мидлвейр «потока»
const middlewares = [
	filterResults.middleware,
];

// Наш стор
export default createStore<AppStore>(
	combineReducers(reducers),
	applyMiddleware(middlewares),
);
```

##### View.tsx
```tsx
import {connect, Flow} from 'react-jssdk';

export default connect(state => state, ...)(({
	filter,
	ui: {detail},
	uiDetailToggle, // действие
	filterResults,  // найденных писем
}) =>
	<div>
		<h1>{filter.id ? 'Редактирование фильтра' : 'Создание фильтра'}</h1>
		<ConditionsView entries={filter.get('conditions')}/>
		<a onClick={() => uiDetailToggle()}>{detail ? 'Скрыть' : 'Показать'}</a>
		{detail && <DetailView {...filter.toJSON(true)}/>}

		<Flow
			source={filterResults}
			pending={<Loading/>}
			failed={<Error/>}
		>
			<div>Найдено: {filterResults.count}</div>
		</Flow>
	</div>
});
```

---

<a name="connect"></a>
#### `connect`
Это не какая-то своя имплементация, это просто надстройка над [оригинальным](https://github.com/reactjs/react-redux/blob/master/docs/api.md#connectmapstatetoprops-mapdispatchtoprops-mergeprops-options),
он всё так же создаёт имутабильный `HOC`, но с одним отличием, есть у свойства, которое вы достали из `state` есть методы `on` и `off`,
то он подписывается на события `change` или `add remove sort reset update`, при срабатывании которых вызывается `forceUpdate` (сгруппированый по `requestAnimationFrame`).

Всё это значит, что вы можете спокойно использовать JSSDK модели и списки моделей в `state`,
а коннектор сам позаботится о подписки и отписки на получаемые модели через коннектор.

---

<a name="createFlow"></a>
#### `createFlow<P, S>(scheme):{reducer, middleware}`
Создание «потока» данных. Поток имеет 4 базовых свойства `pending: boolean`, `success: boolean`,
`failed: boolean` и `error: Error`.

 - **scheme**
   - **name**: `string` — namespace «потоко», должно быть уникально  (обязательное поле)
   - **defaults**: `S` — значения по умолчанию (обязательное поле)
   - **effects**: `object` (опционально)
     - `[actionType: string]: (action, dispatch, getState) => Promise<Partial<S>>`
   - **reducer** : `(state: S, action) => S` (опционально)

```ts
// threads.flow.ts
import {createFlow, FlowProps} from 'react-jssdk';

export interface ThreadsStateProps extends FlowProps {
	list: {id: string}[];
}

export default createFlow<ThreadsStateProps, {}>({
	name: 'THREADS',
	defaults: {list: []},
	effects: {
		'FOLDER/SELECT': ({payload: {id}}) => Threads.find({folder: id}).then(list => ({list})),
	},
	reducer: state => state,
});
```

---

<a name="Flow"></a>
#### `<Flow/>`
Компонент, для удобной работы с потоком

 - **source**: `FlowProps` — поток
 - **pending**: `React.ReactNode` — компонент отвечающий за поток в состоянии `pending`
 - **failed**: `React.ReactNode`
 - **children**: `string | React.ReactNode`
 - **pendingDelayBeforeShow?**: `number` — задержка перед показом `pending`
 - **pendingDelayBeforeHide?**: `number`

```tsx
import {Flow} from 'react-jssdk';

export default ({threads}) =>
	<Flow
		source={threads}
		failed={<Error message="Ошибка загрузки списка тредов"/>}
	>
		Загружено {threads.list.length} тредов.
	</Flow>
};
```

---

### Development

 - `npm i`
 - `npm test`, [code coverage](./coverage/lcov-report/index.html)
