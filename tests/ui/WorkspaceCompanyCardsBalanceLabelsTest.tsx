import {render, screen} from '@testing-library/react-native';

import WorkspaceCompanyCardsBalanceLabels from '@pages/workspace/companyCards/WorkspaceCompanyCardsBalanceLabels';

import type {CombinedCardFeed, CompanyCardFeedWithDomainID} from '@src/types/onyx/CardFeeds';

import React from 'react';

jest.mock('@hooks/useResponsiveLayout', () => ({
    __esModule: true,
    default: () => ({shouldUseNarrowLayout: false}),
}));

jest.mock('@hooks/useThemeStyles', () => ({
    __esModule: true,
    default: () => ({
        flexRow: {},
        ph5: {},
        mt2: {},
        mb6: {},
        gap4: {},
        gap96: {},
        flex1: {},
    }),
}));

jest.mock('@pages/workspace/companyCards/WorkspaceCompanyCardsBalanceLabel', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const ReactMock = require('react');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const {View} = require('react-native');
    return {
        __esModule: true,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        default: () => ReactMock.createElement(View, {testID: 'company-card-balance-label'}),
    };
});

const balanceFeed = {
    currentBalance: 10000,
    remainingLimit: 50000,
    balanceTimestamp: '2026-09-19 20:00:00',
    balanceCurrency: 'USD',
} as unknown as CombinedCardFeed;

function renderBalanceLabels(feedName: string, selectedFeed: CombinedCardFeed = balanceFeed) {
    return render(
        <WorkspaceCompanyCardsBalanceLabels
            selectedFeed={selectedFeed}
            feedName={feedName as CompanyCardFeedWithDomainID}
        />,
    );
}

describe('WorkspaceCompanyCardsBalanceLabels feed scope', () => {
    it('renders balance data for a Plaid feed', () => {
        renderBalanceLabels('plaid.ins_123456');

        expect(screen.getAllByTestId('company-card-balance-label')).toHaveLength(2);
    });

    it('does not render balance data for an OAuth-only direct feed', () => {
        renderBalanceLabels('oauth.chase.com');

        expect(screen.queryAllByTestId('company-card-balance-label')).toHaveLength(0);
    });

    it('does not render a Plaid balance block when neither value is available', () => {
        const emptyBalanceFeed = {
            currentBalance: null,
            remainingLimit: null,
            balanceTimestamp: '2026-09-19 20:00:00',
            balanceCurrency: 'USD',
        } as unknown as CombinedCardFeed;

        renderBalanceLabels('plaid.ins_123456', emptyBalanceFeed);

        expect(screen.queryAllByTestId('company-card-balance-label')).toHaveLength(0);
    });
});
