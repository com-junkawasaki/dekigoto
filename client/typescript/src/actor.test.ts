import { describe, it, expect } from 'vitest';
import { ReducerAggregate, Reducer } from './actor';
import { Event } from './types';

// Define a simple state, event types, and a reducer for testing
interface TestState {
  count: number;
}

type TestEventData = 
  | { type: 'increment', amount: number }
  | { type: 'decrement', amount: number };

const testReducer: Reducer<TestState, TestEventData> = {
  increment: (state, data) => ({
    count: state.count + data.amount,
  }),
  decrement: (state, data) => ({
    count: state.count - data.amount,
  }),
};

const initialState: TestState = { count: 0 };

describe('ReducerAggregate', () => {
  it('should apply a single event and update the state correctly', () => {
    const events: Event[] = [
      { 
        aggregateId: 'test-1',
        aggregateType: 'counter',
        sequence: 1,
        eventType: 'increment',
        data: { type: 'increment', amount: 5 },
        timestamp: new Date(),
        metadata: {},
      },
    ];

    const aggregate = new ReducerAggregate('test-1', initialState, testReducer, events);
    
    expect(aggregate.getState().count).toBe(5);
  });

  it('should apply multiple events in sequence', () => {
    const events: Event[] = [
      { 
        aggregateId: 'test-1',
        aggregateType: 'counter',
        sequence: 1,
        eventType: 'increment',
        data: { type: 'increment', amount: 10 },
        timestamp: new Date(),
        metadata: {},
      },
      { 
        aggregateId: 'test-1',
        aggregateType: 'counter',
        sequence: 2,
        eventType: 'decrement',
        data: { type: 'decrement', amount: 3 },
        timestamp: new Date(),
        metadata: {},
      },
      { 
        aggregateId: 'test-1',
        aggregateType: 'counter',
        sequence: 3,
        eventType: 'increment',
        data: { type: 'increment', amount: 1 },
        timestamp: new Date(),
        metadata: {},
      },
    ];

    const aggregate = new ReducerAggregate('test-1', initialState, testReducer, events);
    
    expect(aggregate.getState().count).toBe(8);
  });

  it('should return the initial state if no events are provided', () => {
    const events: Event[] = [];
    const aggregate = new ReducerAggregate('test-1', initialState, testReducer, events);
    
    expect(aggregate.getState().count).toBe(0);
  });
});
