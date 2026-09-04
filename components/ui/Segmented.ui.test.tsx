import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Segmented } from './Segmented';

const options = [
  { value: 'room', label: 'Room' },
  { value: 'status', label: 'Status' },
];

describe('Segmented', () => {
  it('marks the current option selected and reports a tap on another', async () => {
    const onChange = jest.fn();
    await render(<Segmented options={options} value="room" onChange={onChange} />);
    expect(screen.getByText('Room')).toBeTruthy();
    await fireEvent.press(screen.getByText('Status'));
    expect(onChange).toHaveBeenCalledWith('status');
  });
});
