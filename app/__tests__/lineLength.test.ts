import {classifyDelivery} from '../src/domain/lineLength';

test('classifies length zones down the pitch', () => {
  expect(classifyDelivery({x: 0, y: 0.5}).length).toBe('yorker');
  expect(classifyDelivery({x: 0, y: 2}).length).toBe('full');
  expect(classifyDelivery({x: 0, y: 4.5}).length).toBe('good');
  expect(classifyDelivery({x: 0, y: 7}).length).toBe('backOfLength');
  expect(classifyDelivery({x: 0, y: 10}).length).toBe('short');
});

test('classifies line zones relative to the stumps (right-hander)', () => {
  expect(classifyDelivery({x: 0, y: 4}).line).toBe('middle');
  expect(classifyDelivery({x: 0.08, y: 4}).line).toBe('offStump');
  expect(classifyDelivery({x: 0.2, y: 4}).line).toBe('outsideOff');
  expect(classifyDelivery({x: 0.4, y: 4}).line).toBe('wideOutsideOff');
  expect(classifyDelivery({x: -0.08, y: 4}).line).toBe('legStump');
  expect(classifyDelivery({x: -0.2, y: 4}).line).toBe('downLeg');
});

test('mirrors the line for a left-hander', () => {
  // +x is the off side for a right-hander but the leg side for a left-hander.
  expect(classifyDelivery({x: 0.2, y: 4}, 'left').line).toBe('downLeg');
  expect(classifyDelivery({x: -0.4, y: 4}, 'left').line).toBe('wideOutsideOff');
});
