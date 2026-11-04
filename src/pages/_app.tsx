import App, { AppContext, AppInitialProps, AppProps } from "next/app";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { MantineProvider } from "@mantine/core";
import { mmrfModals } from "@/components/Modals/registerModals";
import mantinetheme from "../mantineTheme";

import {
  Gen3Provider,
  registerCohortBuilderDefaultPreviewRenderers,
  registerExplorerDefaultCellRenderers,
  registerMetadataSchemaApp,
  registerDiscoveryDefaultCellRenderers,
} from "@gen3/frontend";

import { registerCohortTableCustomCellRenderers } from "@/lib/CohortBuilder/CustomCellRenderers";
import { registerCustomExplorerDetailsPanels } from "@/lib/CohortBuilder/FileDetailsPanel";
import { registerDiscoveryCustomCellRenderers } from "@/lib/Discovery/CustomCellRenderers";

import "../styles/globals.css";
import "../styles/survivalplot.css";
import "@fontsource/montserrat";
import "@fontsource/source-sans-pro";
import "@fontsource/noto-sans";

import { setDRSHostnames } from "@gen3/core";
import drsHostnames from "../../config/drsHostnames.json";
import { loadAppConfig, type AppConfig } from "@/lib/content/loadAppConfig";
import Loading from "../components/Loading";
import { registerCohortComparisonApp } from "@/features/cohortComparison/registerApp";
import { registerGenesAndMutationFrequencyAnalysisTool } from "@/features/genomic/registerApp";
import Gen3GDCCompatabilityProvider from "@/utils/providers";
import { registerMMRFTableCellRenderers } from "@/components/ExplorerCellRenderers";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import MaintenanceNotice from "@/components/MaintenanceNotice";
import GoogleAnalyticsLoader from "@/components/GoogleAnalyticsLoader";
import { isAnalyticsAllowed } from "@/lib/analytics";
import MainNavigation from "@/components/Navigation/MainNavigation/MainNavigation";
import { isChatPage } from "@/features/chat/isChatPage";
import {
  acceptCookieConsent,
  dismissCookieConsentForSession,
  getCookieConsentState,
  type CookieConsentState,
} from "@/lib/cookieConsent";
import {
  DefaultAuthorizedRoutesConfig,
} from '@gen3/frontend';

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactDOM = require("react-dom");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const axe = require("@axe-core/react");
  axe(React, ReactDOM, 1000);
}

type Gen3AppProps = AppConfig;

const Gen3App = ({
  Component,
  pageProps,
  icons,
  sessionConfig,
  modalsConfig,
}: AppProps & Gen3AppProps) => {
  const isFirstRender = useRef(true);
  const router = useRouter();
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const syntheticSandbox = process.env.NEXT_PUBLIC_SYNTHETIC_SANDBOX === '1';
  const isChat = isChatPage(router.pathname, router.query.app);
  const hideMainNavigation = router.pathname === "/Login" || isChat;

  useEffect(() => {
    if (isFirstRender.current) {
      setDRSHostnames(drsHostnames);
      registerMetadataSchemaApp();
      registerDiscoveryDefaultCellRenderers();
      registerExplorerDefaultCellRenderers();
      registerCohortBuilderDefaultPreviewRenderers();
      registerCohortTableCustomCellRenderers();
      registerDiscoveryCustomCellRenderers();
      registerMMRFTableCellRenderers();
      registerCustomExplorerDetailsPanels();
      registerCohortComparisonApp();
      registerGenesAndMutationFrequencyAnalysisTool();

      isFirstRender.current = false;
    }
  }, []);

  const [isClient, setIsClient] = useState(false);
  const [cookieConsentState, setCookieConsentState] =
    useState<CookieConsentState>('pending');
  const analyticsAllowed = isClient && isAnalyticsAllowed({
    nodeEnv: process.env.NODE_ENV,
    syntheticSandbox,
    hostname: window.location.hostname,
    analyticsHostname: process.env.NEXT_PUBLIC_GA_HOSTNAME,
  });

  useEffect(() => {
    setCookieConsentState(getCookieConsentState());
    setIsClient(true); // Only on the client-side
  }, []);

  const handleCookieConsentAccept = () => {
    acceptCookieConsent();
    setCookieConsentState('accepted');
  };

  const handleCookieConsentDismiss = () => {
    dismissCookieConsentForSession();
    setCookieConsentState('dismissed');
  };

  return (
    <React.Fragment>
      {isClient ? (
        <Suspense fallback={<Loading />}>
          <MantineProvider theme={mantinetheme}>
            <Gen3Provider
              icons={icons}
              sessionConfig={sessionConfig}
              modalsConfig={modalsConfig}
              contextModals={mmrfModals}
            >
              <Gen3GDCCompatabilityProvider>
                {syntheticSandbox && (
                  <div role="note" className={`bg-amber-100 text-center text-amber-950 ${isChat ? "p-1 text-xs" : "p-3 text-sm"}`}>
                    Synthetic sandbox — all data is fabricated and has no clinical meaning.
                  </div>
                )}
                {!hideMainNavigation && <MainNavigation />}
                <Component {...pageProps} />
                <MaintenanceNotice
                  blocked={analyticsAllowed && cookieConsentState === 'pending'}
                />
                <GoogleAnalyticsLoader
                  enabled={analyticsAllowed && cookieConsentState === 'accepted'}
                  gaMeasurementId={gaMeasurementId}
                />
                {analyticsAllowed && cookieConsentState === 'pending' && (
                  <CookieConsentBanner
                    onAccept={handleCookieConsentAccept}
                    onDismiss={handleCookieConsentDismiss}
                  />
                )}
              </Gen3GDCCompatabilityProvider>
            </Gen3Provider>
          </MantineProvider>
        </Suspense>
      ) : (
        // Show some fallback UI while waiting for the client to load
        <Loading />
      )}
    </React.Fragment>
  );
};

// TODO: replace with page router
Gen3App.getInitialProps = async (
  context: AppContext,
): Promise<Gen3AppProps & AppInitialProps> => {
  const ctx = await App.getInitialProps(context);

  try {
    const res = await loadAppConfig();
    return {
      ...ctx,
      ...res,
    };
  } catch (error: unknown) {
    console.error("Provider Wrapper error loading config", String(error));
  }
  // return default
  return {
    ...ctx,
    icons: [
      {
        prefix: 'gen3',
        lastModified: 0,
        icons: {},
        width: 0,
        height: 0,
      },
    ],
    modalsConfig: { systemUseModal: { enabled: false, content: { text: [] } } },
    sessionConfig: {},
    protectedRoutes: DefaultAuthorizedRoutesConfig,
  };
};
export default Gen3App;
