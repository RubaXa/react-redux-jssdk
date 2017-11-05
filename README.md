React-Redux-JSSDK
-----------------
Работа с JSSDK поверх React, плюс высякие хелперы.

```
npm i --save react-jssdk
```

### API

 - [connect](#connect) — коннектор для redux


---

#### `connect`
Это не какая-то своя имплементация, это просто надстройка над [оригинальным коонектором](https://github.com/reactjs/react-redux/blob/master/docs/api.md#connectmapstatetoprops-mapdispatchtoprops-mergeprops-options),
он всё так же создаёт имутабильный `HOC`, но с одним отличием, есть у свойства, которое вы достали из `state` есть методы `on` и `off`,
то он подписывается на события `change` или `add remove sort reset update`, при срабатывании которых вызывается `forceUpdate` (сгруппированый по `requestAnimationFrame`).

Всё это значит, что вы можете спокойно использовать JSSDK модели и списки моделей в `state`,
а коннектор сам позаботиться о подписки и отписки на получаемые модели через коннектор.

Простой пример

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

export interface FilterResultsStateProps implements FlowProps {
	count: number;
}

export interface AppStore {
	filter: FilterStateProps;
	ui: UIStateProps;
	filterResults: FilterResultsStateProps;
}

// «Поток» получения количества писем подходящих под условия фильтрации
const filterResults = createFlow<FilterResultsStateProps, AppStore>({
	effects: {
		'FILTER/CONDITIONS': ({payload}) => RPC.call('filters/check', payload).then(req => ({count: req.get('body')})),
	},
	reducer: (state = {count: 0}) => state,
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


### Development

 - `npm i`
 - `npm test`, [code coverage](./coverage/lcov-report/index.html)
