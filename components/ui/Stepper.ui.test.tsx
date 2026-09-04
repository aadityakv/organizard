import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Stepper } from './Stepper';

describe('Stepper', () => {
  it('steps within [min, max] and reports each change', async () => {
    const onChange = jest.fn();
    await render(<Stepper value={1} min={1} max={3} onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('Decrease')); // disabled at min
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Increase'));
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it('accepts a typed number and clamps it on blur', async () => {
    const onChange = jest.fn();
    await render(<Stepper value={1} min={1} max={99} onChange={onChange} />);
    const field = screen.getByDisplayValue('1');
    await fireEvent.changeText(field, '250');
    await fireEvent(field, 'blur');
    expect(onChange).toHaveBeenLastCalledWith(99);
  });
});
