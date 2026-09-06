/** Regression coverage for retained Search creation keys, snapshot gaps, and lifecycle rearming. */
import {act, renderHook} from '@testing-library/react-native';

import useOptimisticSearchTracking from '@components/Search/hooks/useOptimisticSearchTracking';
import useStableOptimisticSortedData from '@components/Search/hooks/useStableOptimisticSortedData';
import type {SearchQueryJSON} from '@components/Search/types';

import {flushDeferredWrite, getOptimisticWatchKey, hasDeferredWrite, registerDeferredWrite, reserveDeferredWriteChannel, resetForTesting} from '@libs/deferredLayoutWrite';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SearchResults from '@src/types/onyx/SearchResults';
import type Transaction from '@src/types/onyx/Transaction';

import {useMemo} from 'react';

import {buildTransactionRow} from '../../utils/collections/searchListItems';

jest.mock('@libs/SearchUIUtils', () => ({
    isSearchDataLoaded: () => true,
    isTransactionSearchType: (type: string) => type === 'expense' || type === 'invoice',
}));
jest.mock('@libs/ReportActionsUtils', () => ({
    isMoneyRequestAction: jest.fn(),
    getOriginalMessage: jest.fn(),
}));
jest.mock('@libs/telemetry/submitFollowUpAction', () => ({
    getPendingSubmitFollowUpAction: () => undefined,
}));

const TRANSACTION_ID = '42';
const TRANSACTION_KEY = `${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`;
const SEARCH_CHANNEL = CONST.DEFERRED_LAYOUT_WRITE_KEYS.SEARCH;
const HASH = 123;
type HookParams = Parameters<typeof useOptimisticSearchTracking>[0];

// Only query type is read by these hooks; full parsing is covered by SearchQueryUtils tests.
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
const queryJSON = {hash: HASH, type: CONST.SEARCH.DATA_TYPES.EXPENSE} as SearchQueryJSON;

function makeSnapshot(transaction?: Transaction): SearchResults {
    return {
        data: transaction ? {[TRANSACTION_KEY]: transaction} : {},
        search: {
            offset: 0,
            type: CONST.SEARCH.DATA_TYPES.EXPENSE,
            hash: HASH,
            hasMoreResults: false,
            hasResults: !!transaction,
            isLoading: false,
            sortBy: CONST.SEARCH.TABLE_COLUMNS.DATE,
            sortOrder: CONST.SEARCH.SORT_ORDER.DESC,
        },
    };
}

function makeTransaction(pendingAction: Transaction['pendingAction']): Transaction {
    return buildTransactionRow(42, TRANSACTION_ID, {reportID: '7', pendingAction});
}

function makeProps(transaction?: Transaction, snapshot = makeSnapshot()): HookParams {
    return {
        queryJSON,
        searchResults: snapshot,
        transactions: transaction ? {[TRANSACTION_KEY]: transaction} : undefined,
        reportActions: undefined,
    };
}

// Run both real hooks with the same order as useSearchSnapshot. The unrelated
// display/sort projection is represented by a typed row from the shared factory.
function useOptimisticLifecycle(props: HookParams) {
    const tracking = useOptimisticSearchTracking(props);
    const searchData = tracking.searchDataWithOptimisticTransaction;
    const sortedData = useMemo(() => {
        return Object.keys(searchData ?? {}).flatMap((key) => {
            if (!key.startsWith(ONYXKEYS.COLLECTION.TRANSACTION)) {
                return [];
            }
            // Keys are narrowed by the collection prefix before looking up the transaction.
            const transaction = searchData?.[key as `${typeof ONYXKEYS.COLLECTION.TRANSACTION}${string}`];
            return transaction ? [buildTransactionRow(Number(transaction.transactionID), transaction.transactionID, {...transaction, errors: undefined})] : [];
        });
    }, [searchData]);
    const stable = useStableOptimisticSortedData(sortedData, props.searchResults, tracking.trackingState);
    return {data: stable.stableSortedData, trackingState: tracking.trackingState, rearmTracking: tracking.rearmTracking};
}

function consumeReservedChannel() {
    const write = jest.fn();
    reserveDeferredWriteChannel(SEARCH_CHANNEL);
    flushDeferredWrite(SEARCH_CHANNEL);
    registerDeferredWrite(SEARCH_CHANNEL, write, {optimisticWatchKey: TRANSACTION_KEY});
    expect(write).toHaveBeenCalledTimes(1);
    expect(hasDeferredWrite(SEARCH_CHANNEL)).toBe(false);
    expect(getOptimisticWatchKey(SEARCH_CHANNEL)).toBe(TRANSACTION_KEY);
}

describe('optimistic Search creation lifecycle', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        resetForTesting();
    });

    afterEach(() => {
        resetForTesting();
        jest.useRealTimers();
    });

    it('does not restore a settled transaction excluded by a later search snapshot', () => {
        consumeReservedChannel();
        const {result} = renderHook(useOptimisticLifecycle, {initialProps: makeProps(makeTransaction(null))});
        expect(result.current.data).toEqual([]);
        expect(result.current.trackingState.optimisticWatchKey).toBeUndefined();
    });

    it('keeps a late creation visible between settlement and the server snapshot', () => {
        consumeReservedChannel();
        const pending = makeTransaction(CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD);
        const {result, rerender} = renderHook(useOptimisticLifecycle, {initialProps: makeProps(pending)});
        expect(result.current.data).toHaveLength(1);

        const settled = {...pending, pendingAction: null};
        rerender(makeProps(settled));
        expect(result.current.data).toHaveLength(1);

        rerender(makeProps(settled, makeSnapshot(settled)));
        expect(result.current.data).toHaveLength(1);
        expect(result.current.trackingState.optimisticWatchKey).toBeUndefined();
    });

    it('arms the lifecycle when the transaction collection arrives after mount', () => {
        consumeReservedChannel();
        const {result, rerender} = renderHook(useOptimisticLifecycle, {initialProps: makeProps()});
        expect(result.current.data).toEqual([]);
        expect(result.current.trackingState.optimisticWatchKey).toBeUndefined();

        const pending = makeTransaction(CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD);
        rerender(makeProps(pending));
        expect(result.current.data).toHaveLength(1);

        rerender(makeProps({...pending, pendingAction: null}));
        expect(result.current.data).toHaveLength(1);
    });

    it('removes a rolled-back late creation after the existing grace period', () => {
        consumeReservedChannel();
        const {result, rerender} = renderHook(useOptimisticLifecycle, {
            initialProps: makeProps(makeTransaction(CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD)),
        });
        rerender(makeProps());
        expect(result.current.data).toHaveLength(1);

        act(() => jest.advanceTimersByTime(3001));
        expect(result.current.data).toEqual([]);
        expect(result.current.trackingState.optimisticWatchKey).toBeUndefined();
    });

    it('does not expose a settled retained key as an optimistic status-filter identity', () => {
        consumeReservedChannel();
        const settled = makeTransaction(null);
        const {result} = renderHook(useOptimisticLifecycle, {initialProps: makeProps(settled, makeSnapshot(settled))});
        expect(result.current.data).toHaveLength(1);
        expect(result.current.trackingState.optimisticWatchKey).toBeUndefined();
    });

    it('still resolves a watch key registered after Search mounts', () => {
        reserveDeferredWriteChannel(SEARCH_CHANNEL);
        const {result, rerender} = renderHook(useOptimisticLifecycle, {initialProps: makeProps()});
        flushDeferredWrite(SEARCH_CHANNEL);
        registerDeferredWrite(SEARCH_CHANNEL, jest.fn(), {optimisticWatchKey: TRANSACTION_KEY});

        rerender(makeProps(makeTransaction(CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD)));
        act(() => jest.advanceTimersByTime(20));
        expect(result.current.data).toHaveLength(1);
    });

    it('does not let an old rollback timer clear a new creation', () => {
        consumeReservedChannel();
        const {result, rerender} = renderHook(useOptimisticLifecycle, {
            initialProps: makeProps(makeTransaction(CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD)),
        });
        rerender(makeProps());
        const nextKey = `${ONYXKEYS.COLLECTION.TRANSACTION}43`;
        reserveDeferredWriteChannel(SEARCH_CHANNEL);
        registerDeferredWrite(SEARCH_CHANNEL, jest.fn(), {optimisticWatchKey: nextKey});
        act(() => result.current.rearmTracking());
        act(() => jest.advanceTimersByTime(3001));
        expect(result.current.trackingState.optimisticWatchKey).toBe(nextKey);

        const nextTransaction = {...makeTransaction(CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD), transactionID: '43'};
        rerender({...makeProps(), transactions: {[nextKey]: nextTransaction}});
        expect(result.current.data).toEqual([expect.objectContaining({transactionID: '43'})]);
    });
});
