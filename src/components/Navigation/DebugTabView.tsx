import Button from '@components/ButtonComposed';
import Icon from '@components/Icon';
import Text from '@components/Text';

import useIndicatorStatus from '@hooks/useIndicatorStatus';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useReportAttributes from '@hooks/useReportAttributes';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useRootNavigationState from '@hooks/useRootNavigationState';
import {useSidebarOrderedReportsState} from '@hooks/useSidebarOrderedReports';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

import createDynamicRoute from '@libs/Navigation/helpers/dynamicRoutesUtils/createDynamicRoute';
import getFocusedLeafScreenName from '@libs/Navigation/helpers/getFocusedLeafScreenName';
import isTabRouteAtRoot from '@libs/Navigation/helpers/isTabRouteAtRoot';
import Navigation from '@libs/Navigation/Navigation';
import {getChatTabBrickRoadReportID} from '@libs/WorkspacesSettingsUtils';

import variables from '@styles/variables';

import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import NAVIGATORS from '@src/NAVIGATORS';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import ROUTES, {DYNAMIC_ROUTES} from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type {ReimbursementAccount} from '@src/types/onyx';
import type IndicatorStatus from '@src/types/utils/IndicatorStatus';

import type {NavigationState} from '@react-navigation/native';
import type {OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';

import React, {useCallback, useMemo} from 'react';
import {View} from 'react-native';

import NAVIGATION_TABS from './NavigationTabBar/NAVIGATION_TABS';

function getActiveTabRoute(rootState: NavigationState | undefined) {
    if (!rootState) {
        return undefined;
    }
    // Multiple TAB_NAVIGATOR instances can exist in the root stack (e.g. workspace nav from RHP
    // pushes a new one). Use `findLast` to read state from the most recent tab navigator,
    // even when the focused root route is a modal — the bar should stay mounted under the RHP
    // and just be visually covered by it.
    const tabRoute = rootState.routes.findLast((route) => route.name === NAVIGATORS.TAB_NAVIGATOR);
    return tabRoute?.state?.routes?.[tabRoute.state.index ?? 0];
}

function getSettingsMessage(status: IndicatorStatus | undefined): TranslationPaths | undefined {
    switch (status) {
        case CONST.INDICATOR_STATUS.HAS_CUSTOM_UNITS_ERROR:
            return 'debug.indicatorStatus.theresAWorkspaceWithCustomUnitsErrors';
        case CONST.INDICATOR_STATUS.HAS_EMPLOYEE_LIST_ERROR:
            return 'debug.indicatorStatus.theresAProblemWithAWorkspaceMember';
        case CONST.INDICATOR_STATUS.HAS_QBO_EXPORT_ERROR:
            return 'debug.indicatorStatus.theresAProblemWithAWorkspaceQBOExport';
        case CONST.INDICATOR_STATUS.HAS_LOGIN_LIST_ERROR:
            return 'debug.indicatorStatus.theresAProblemWithAContactMethod';
        case CONST.INDICATOR_STATUS.HAS_LOGIN_LIST_INFO:
            return 'debug.indicatorStatus.aContactMethodRequiresVerification';
        case CONST.INDICATOR_STATUS.HAS_PAYMENT_METHOD_ERROR:
            return 'debug.indicatorStatus.theresAProblemWithAPaymentMethod';
        case CONST.INDICATOR_STATUS.HAS_POLICY_ERRORS:
            return 'debug.indicatorStatus.theresAProblemWithAWorkspace';
        case CONST.INDICATOR_STATUS.HAS_REIMBURSEMENT_ACCOUNT_ERRORS:
            return 'debug.indicatorStatus.theresAProblemWithYourReimbursementAccount';
        case CONST.INDICATOR_STATUS.HAS_SUBSCRIPTION_ERRORS:
            return 'debug.indicatorStatus.theresABillingProblemWithYourSubscription';
        case CONST.INDICATOR_STATUS.HAS_SUBSCRIPTION_INFO:
            return 'debug.indicatorStatus.yourSubscriptionHasBeenSuccessfullyRenewed';
        case CONST.INDICATOR_STATUS.HAS_SYNC_ERRORS:
            return 'debug.indicatorStatus.theresWasAProblemDuringAWorkspaceConnectionSync';
        case CONST.INDICATOR_STATUS.HAS_USER_WALLET_ERRORS:
            return 'debug.indicatorStatus.theresAProblemWithYourWallet';
        case CONST.INDICATOR_STATUS.HAS_WALLET_TERMS_ERRORS:
            return 'debug.indicatorStatus.theresAProblemWithYourWalletTerms';
        case CONST.INDICATOR_STATUS.HAS_LOCKED_BANK_ACCOUNT:
            return 'debug.indicatorStatus.aBankAccountIsLocked';
        case CONST.INDICATOR_STATUS.HAS_MERGE_HR_SETUP_NEEDED:
            return 'debug.indicatorStatus.completeHrSetup';
        case CONST.INDICATOR_STATUS.HAS_HR_CONNECTION_ERROR:
            return 'debug.indicatorStatus.theresAProblemWithAnHRConnection';
        default:
            return undefined;
    }
}

function getSettingsRoute(status: IndicatorStatus | undefined, reimbursementAccount: OnyxEntry<ReimbursementAccount>, indicatorPolicyID = ''): Route | undefined {
    switch (status) {
        case CONST.INDICATOR_STATUS.HAS_CUSTOM_UNITS_ERROR:
            return ROUTES.WORKSPACE_DISTANCE_RATES.getRoute(indicatorPolicyID);
        case CONST.INDICATOR_STATUS.HAS_EMPLOYEE_LIST_ERROR:
            return ROUTES.WORKSPACE_MEMBERS.getRoute(indicatorPolicyID);
        case CONST.INDICATOR_STATUS.HAS_LOGIN_LIST_ERROR:
            return createDynamicRoute(DYNAMIC_ROUTES.CONTACT_METHODS.path);
        case CONST.INDICATOR_STATUS.HAS_LOGIN_LIST_INFO:
            return createDynamicRoute(DYNAMIC_ROUTES.CONTACT_METHODS.path);
        case CONST.INDICATOR_STATUS.HAS_PAYMENT_METHOD_ERROR:
            return ROUTES.SETTINGS_WALLET;
        case CONST.INDICATOR_STATUS.HAS_POLICY_ERRORS:
            return ROUTES.WORKSPACE_INITIAL.getRoute(indicatorPolicyID);
        case CONST.INDICATOR_STATUS.HAS_REIMBURSEMENT_ACCOUNT_ERRORS:
            return ROUTES.BANK_ACCOUNT_WITH_STEP_TO_OPEN.getRoute({policyID: reimbursementAccount?.achData?.policyID});
        case CONST.INDICATOR_STATUS.HAS_SUBSCRIPTION_ERRORS:
            return ROUTES.SETTINGS_SUBSCRIPTION.route;
        case CONST.INDICATOR_STATUS.HAS_SUBSCRIPTION_INFO:
            return ROUTES.SETTINGS_SUBSCRIPTION.route;
        case CONST.INDICATOR_STATUS.HAS_SYNC_ERRORS:
            return ROUTES.WORKSPACE_ACCOUNTING.getRoute(indicatorPolicyID);
        case CONST.INDICATOR_STATUS.HAS_USER_WALLET_ERRORS:
            return ROUTES.SETTINGS_WALLET;
        case CONST.INDICATOR_STATUS.HAS_WALLET_TERMS_ERRORS:
            return ROUTES.SETTINGS_WALLET;
        case CONST.INDICATOR_STATUS.HAS_LOCKED_BANK_ACCOUNT:
            return ROUTES.SETTINGS_WALLET;
        case CONST.INDICATOR_STATUS.HAS_MERGE_HR_SETUP_NEEDED:
        case CONST.INDICATOR_STATUS.HAS_HR_CONNECTION_ERROR:
            return ROUTES.WORKSPACE_HR.getRoute(indicatorPolicyID);
        default:
            return undefined;
    }
}

type DebugTabViewProps = {
    /** The navigation tab whose status the banner explains. */
    selectedTab: ValueOf<typeof NAVIGATION_TABS>;
};

type DebugTabViewData = {
    indicator: string;
    message: TranslationPaths;
    navigateTo: () => void;
};

type DebugTabViewContentProps = {
    /** The color of the status indicator. */
    indicator: string;
    /** The localized status message key. */
    message: TranslationPaths;
    /** Open the page where the status can be addressed. */
    onPress: () => void;
};

function isOnFullWidthTabRoot(rootState: NavigationState | undefined): boolean {
    const activeRoute = getActiveTabRoute(rootState);
    if (!activeRoute) {
        return false;
    }
    const focusedLeaf = getFocusedLeafScreenName(activeRoute.state) ?? activeRoute.name;
    return focusedLeaf === SCREENS.WORKSPACES_LIST || focusedLeaf === SCREENS.DOMAINS_LIST;
}

function useDebugTabViewData(selectedTab: ValueOf<typeof NAVIGATION_TABS>): DebugTabViewData | undefined {
    const theme = useTheme();
    const [reimbursementAccount] = useOnyx(ONYXKEYS.REIMBURSEMENT_ACCOUNT);
    const reportAttributes = useReportAttributes();
    const {status, indicatorColor, indicatorPolicyID} = useIndicatorStatus();
    const {orderedReportIDs, chatTabBrickRoad} = useSidebarOrderedReportsState();

    const message = useMemo((): TranslationPaths | undefined => {
        if (selectedTab === NAVIGATION_TABS.INBOX) {
            if (chatTabBrickRoad === CONST.BRICK_ROAD_INDICATOR_STATUS.INFO) {
                return 'debug.indicatorStatus.theresAReportAwaitingAction';
            }
            if (chatTabBrickRoad === CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR) {
                return 'debug.indicatorStatus.theresAReportWithErrors';
            }
        }
        if (selectedTab === NAVIGATION_TABS.SETTINGS || selectedTab === NAVIGATION_TABS.WORKSPACES) {
            return getSettingsMessage(status);
        }
    }, [selectedTab, chatTabBrickRoad, status]);

    const indicator = useMemo(() => {
        if (selectedTab === NAVIGATION_TABS.INBOX) {
            if (chatTabBrickRoad === CONST.BRICK_ROAD_INDICATOR_STATUS.INFO) {
                return theme.success;
            }
            if (chatTabBrickRoad === CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR) {
                return theme.danger;
            }
        }
        if (selectedTab === NAVIGATION_TABS.SETTINGS || selectedTab === NAVIGATION_TABS.WORKSPACES) {
            if (status) {
                return indicatorColor;
            }
        }
    }, [selectedTab, chatTabBrickRoad, theme.success, theme.danger, status, indicatorColor]);

    const navigateTo = useCallback(() => {
        if (selectedTab === NAVIGATION_TABS.INBOX && !!chatTabBrickRoad) {
            const reportID = getChatTabBrickRoadReportID(orderedReportIDs, reportAttributes);

            if (reportID) {
                Navigation.navigate(ROUTES.DEBUG_REPORT.getRoute(reportID));
            }
        }
        if (selectedTab === NAVIGATION_TABS.SETTINGS || selectedTab === NAVIGATION_TABS.WORKSPACES) {
            const route = getSettingsRoute(status, reimbursementAccount, indicatorPolicyID);

            if (route) {
                Navigation.navigate(route);
            }
        }
    }, [selectedTab, chatTabBrickRoad, orderedReportIDs, reportAttributes, status, reimbursementAccount, indicatorPolicyID]);

    if (!([NAVIGATION_TABS.INBOX, NAVIGATION_TABS.SETTINGS, NAVIGATION_TABS.WORKSPACES] as string[]).includes(selectedTab) || !indicator || !message) {
        return undefined;
    }

    return {indicator, message, navigateTo};
}

function DebugTabViewContent({indicator, message, onPress}: DebugTabViewContentProps) {
    const StyleUtils = useStyleUtils();
    const theme = useTheme();
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const icons = useMemoizedLazyExpensifyIcons(['DotIndicator']);

    return (
        <View
            testID="DebugTabView"
            style={[StyleUtils.getBackgroundColorStyle(theme.cardBG), styles.p3, styles.flexRow, styles.justifyContentBetween, styles.alignItemsCenter]}
        >
            <View style={[styles.flexRow, styles.gap2, styles.flex1, styles.alignItemsCenter]}>
                <Icon
                    src={icons.DotIndicator}
                    fill={indicator}
                />
                <Text style={[StyleUtils.getColorStyle(theme.text), styles.lh20]}>{translate(message)}</Text>
            </View>
            <Button onPress={onPress}>
                <Button.Text>{translate('common.view')}</Button.Text>
            </Button>
        </View>
    );
}

function DebugTabView({selectedTab}: DebugTabViewProps) {
    const styles = useThemeStyles();
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const isAtRoot = useRootNavigationState((rootState) => {
        const activeRoute = getActiveTabRoute(rootState);
        return activeRoute ? isTabRouteAtRoot(activeRoute) : false;
    });
    const isFullWidthTabRoot = useRootNavigationState(isOnFullWidthTabRoot);
    const data = useDebugTabViewData(selectedTab);

    if (!data || (shouldUseNarrowLayout && !isAtRoot) || (!shouldUseNarrowLayout && isFullWidthTabRoot)) {
        return null;
    }

    let positionStyle: {bottom?: number; top?: number; left: number; right?: number; width?: number};
    const verticalAnchor = selectedTab === NAVIGATION_TABS.SETTINGS && !shouldUseNarrowLayout ? {top: 0} : {bottom: 0};
    if (shouldUseNarrowLayout) {
        positionStyle = {bottom: 0, left: 0, right: 0};
    } else {
        positionStyle = {...verticalAnchor, left: variables.navigationTabBarSize, width: variables.sideBarWithLHBWidth - variables.cropBorderWidth};
    }

    // Narrow layouts keep the banner above the bottom tab bar so it does not displace the FAB.
    return (
        <View
            testID="DebugTabViewContainer"
            style={[shouldUseNarrowLayout ? positionStyle : {...styles.pAbsolute, ...positionStyle}]}
            pointerEvents="box-none"
        >
            <DebugTabViewContent
                indicator={data.indicator}
                message={data.message}
                onPress={data.navigateTo}
            />
        </View>
    );
}

function InlineDebugTabView() {
    const styles = useThemeStyles();
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const isFullWidthTabRoot = useRootNavigationState(isOnFullWidthTabRoot);
    const data = useDebugTabViewData(NAVIGATION_TABS.WORKSPACES);

    if (shouldUseNarrowLayout || !isFullWidthTabRoot || !data) {
        return null;
    }

    // Reserve the banner's actual height in the list's column, including beside a side panel.
    return (
        <View
            testID="DebugTabViewContainer"
            style={styles.flexShrink0}
            pointerEvents="box-none"
        >
            <DebugTabViewContent
                indicator={data.indicator}
                message={data.message}
                onPress={data.navigateTo}
            />
        </View>
    );
}

export {InlineDebugTabView};
export default DebugTabView;
