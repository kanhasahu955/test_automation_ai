import { App } from "antd";
import { useEffect } from "react";

/**
 * Show an antd `message.error` toast whenever the redux slice transitions
 * into an error state.
 *
 * Usage:
 *   useReduxErrorToast(error, status === "error");
 */
export const useReduxErrorToast = (
  error: string | null | undefined,
  shouldShow: boolean,
) => {
  const { message } = App.useApp();
  useEffect(() => {
    if (shouldShow && error) message.error(error);
  }, [error, shouldShow, message]);
};

export default useReduxErrorToast;
