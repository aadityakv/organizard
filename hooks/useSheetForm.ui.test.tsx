import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { useSheetForm } from './useSheetForm';

function Harness({ seed }: { seed: string }) {
  const [open, setOpen] = useState(false);
  const [form, patch] = useSheetForm(open, () => ({ name: seed }));
  return (
    <>
      <Text testID="name">{form.name}</Text>
      <Pressable onPress={() => setOpen((o) => !o)}>
        <Text>toggle</Text>
      </Pressable>
      <Pressable onPress={() => patch({ name: 'edited' })}>
        <Text>edit</Text>
      </Pressable>
    </>
  );
}

describe('useSheetForm', () => {
  it('keeps edits while open and re-initialises on the next open', async () => {
    await render(<Harness seed="fresh" />);
    await fireEvent.press(screen.getByText('toggle')); // open
    await fireEvent.press(screen.getByText('edit'));
    expect(screen.getByTestId('name')).toHaveTextContent('edited');
    await fireEvent.press(screen.getByText('toggle')); // close: value is left alone for the exit animation
    expect(screen.getByTestId('name')).toHaveTextContent('edited');
    await fireEvent.press(screen.getByText('toggle')); // open again: back to the seed
    expect(screen.getByTestId('name')).toHaveTextContent('fresh');
  });
});
