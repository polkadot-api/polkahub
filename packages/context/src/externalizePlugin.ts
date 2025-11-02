import { Plugin } from "@polkahub/plugin";
import { state } from "@react-rxjs/core";
import { createKeyedSignal } from "@react-rxjs/utils";
import { useEffect, useId } from "react";
import { usePlugin } from "./polkahubContext";

/**
 * Utility to reference a plugin from outside the context (Advanced use)
 */
export const externalizePlugin = <T extends Plugin<any>>(pluginId: string) => {
  const [pluginChange$, setPlugin] = createKeyedSignal<string, T>();
  const plugin$ = state(pluginChange$);

  const useExternalizePlugin = () => {
    const id = useId();
    const plugin = usePlugin<T>(pluginId);

    useEffect(() => {
      const sub = plugin$(id).subscribe();
      if (plugin) setPlugin(id, plugin);

      return () => sub.unsubscribe();
    }, [id, plugin]);

    return [id, plugin] as const;
  };

  return [plugin$, useExternalizePlugin] as const;
};
