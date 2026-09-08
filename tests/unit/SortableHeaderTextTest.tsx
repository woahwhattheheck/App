import {fireEvent, render, screen} from '@testing-library/react-native';

import SortableHeaderText from '@components/Search/SortableHeaderText';

import CONST from '@src/CONST';

import type {ComponentType} from 'react';
import type {ViewProps} from 'react-native';

import React from 'react';

type PressableProps = {
    onPress: () => void;
};

type ReactNativeActual = {
    View: ComponentType<ViewProps & {onPress?: () => void}>;
};

jest.mock('@components/Icon', () => () => null);
jest.mock('@components/Text', () => () => null);
jest.mock('@components/Pressable/PressableWithFeedback', () => {
    const {createElement} = jest.requireActual<typeof React>('react');
    const {View} = jest.requireActual<ReactNativeActual>('react-native');

    return ({onPress}: PressableProps) =>
        createElement(View, {
            onPress,
            testID: 'sortable-header-pressable',
        });
});

jest.mock('@hooks/useLazyAsset', () => ({
    useMemoizedLazyExpensifyIcons: () => ({ArrowDownLong: 'arrow-down', ArrowUpLong: 'arrow-up'}),
}));
jest.mock('@hooks/useTheme', () => () => ({icon: 'icon'}));
jest.mock('@hooks/useThemeStyles', () => () => ({
    flexRow: {},
    alignItemsCenter: {},
    gap1: {},
    textMicroSupporting: {},
    searchTableHeaderActive: {},
}));

function pressHeader({
    isActive,
    sortOrder,
    defaultSortOrder,
}: {
    isActive: boolean;
    sortOrder: 'asc' | 'desc';
    defaultSortOrder?: 'asc' | 'desc';
}) {
    const onPress = jest.fn();

    render(
        <SortableHeaderText
            text="Date"
            isActive={isActive}
            sortOrder={sortOrder}
            defaultSortOrder={defaultSortOrder}
            onPress={onPress}
            sentryLabel={CONST.SENTRY_LABEL.SEARCH.SORTABLE_HEADER}
        />,
    );

    fireEvent.press(screen.getByTestId('sortable-header-pressable'));
    return onPress;
}

describe('SortableHeaderText', () => {
    it('defaults an inactive column to descending order', () => {
        const onPress = pressHeader({isActive: false, sortOrder: CONST.SEARCH.SORT_ORDER.ASC});

        expect(onPress).toHaveBeenCalledWith(CONST.SEARCH.SORT_ORDER.DESC);
    });

    it('uses an opt-in ascending default for an inactive column', () => {
        const onPress = pressHeader({
            isActive: false,
            sortOrder: CONST.SEARCH.SORT_ORDER.DESC,
            defaultSortOrder: CONST.SEARCH.SORT_ORDER.ASC,
        });

        expect(onPress).toHaveBeenCalledWith(CONST.SEARCH.SORT_ORDER.ASC);
    });

    it('toggles an active descending column to ascending regardless of its default', () => {
        const onPress = pressHeader({
            isActive: true,
            sortOrder: CONST.SEARCH.SORT_ORDER.DESC,
            defaultSortOrder: CONST.SEARCH.SORT_ORDER.DESC,
        });

        expect(onPress).toHaveBeenCalledWith(CONST.SEARCH.SORT_ORDER.ASC);
    });

    it('toggles an active ascending column to descending regardless of its default', () => {
        const onPress = pressHeader({
            isActive: true,
            sortOrder: CONST.SEARCH.SORT_ORDER.ASC,
            defaultSortOrder: CONST.SEARCH.SORT_ORDER.ASC,
        });

        expect(onPress).toHaveBeenCalledWith(CONST.SEARCH.SORT_ORDER.DESC);
    });
});
