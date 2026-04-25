import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
  type TypedUseSelectorHook,
  useDispatch,
  useSelector,
} from "react-redux";
import { persistReducer, persistStore } from "redux-persist";
import storage from "redux-persist/lib/storage";
import createSagaMiddleware from "redux-saga";

import aiReducer from "@features/aiGenerator/aiSlice";
import authReducer from "@features/auth/authSlice";
import executionsReducer from "@features/executions/executionsSlice";
import flowsReducer from "@features/noCodeDesigner/flowsSlice";
import projectsReducer from "@features/projects/projectsSlice";
import reportsReducer from "@features/reports/reportsSlice";
import schedulesReducer from "@features/schedules/schedulesSlice";
import stmReducer from "@features/stmConverter/stmSlice";
import testCasesReducer from "@features/testManagement/testCasesSlice";
import themeReducer from "@features/theme/themeSlice";

import rootSaga from "./rootSaga";

const rootReducer = combineReducers({
  auth: authReducer,
  projects: projectsReducer,
  testCases: testCasesReducer,
  flows: flowsReducer,
  ai: aiReducer,
  stm: stmReducer,
  executions: executionsReducer,
  reports: reportsReducer,
  schedules: schedulesReducer,
  theme: themeReducer,
});

const persistedReducer = persistReducer(
  {
    key: "qf-root",
    storage,
    whitelist: ["auth", "projects", "theme"],
  },
  rootReducer,
);

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      thunk: false,
    }).concat(sagaMiddleware),
});

sagaMiddleware.run(rootSaga);

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
