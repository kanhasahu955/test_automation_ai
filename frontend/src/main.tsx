import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@xyflow/react/dist/style.css";
import "./index.css";

import { App as AntdApp } from "antd";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { PersistGate } from "redux-persist/integration/react";

import App from "@app/App";
import { persistor, store } from "@app/store";
import ErrorBoundary from "@components/common/ErrorBoundary";
import ThemedConfigProvider from "@features/theme/ThemedConfigProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <PersistGate persistor={persistor}>
          <ThemedConfigProvider>
            <AntdApp>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </AntdApp>
          </ThemedConfigProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>,
);
