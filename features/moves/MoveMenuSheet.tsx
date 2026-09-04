// Per-move ⋯ menu — Edit (editors), Archive / Unarchive, and Delete (owner only).
import { StyleSheet, View } from 'react-native';

import { Button, Sheet } from '@/components';
import { PERM } from '@/lib/permissions';
import type { MoveSummary } from '@/store/library';
import { useStore } from '@/store/useStore';
import { space } from '@/theme';
import { ROLES } from '@/shared';

/** Per-move menu: edit, archive/unarchive, delete. */
export function MoveMenuSheet({
  move,
  onClose,
  onEdit,
  onDelete,
}: {
  move: MoveSummary | null;
  onClose: () => void;
  onEdit: (move: MoveSummary) => void;
  onDelete: (move: MoveSummary) => void;
}) {
  return (
    <Sheet visible={move !== null} onClose={onClose} title={move?.name}>
      <View style={styles.menuActions}>
        {move && PERM.canEdit(move.role) && (
          <Button
            variant="secondary"
            fullWidth
            iconLeft="pencil"
            onPress={() => {
              if (move) onEdit(move);
            }}
          >
            Edit move details
          </Button>
        )}
        {move?.archived ? (
          <Button
            variant="secondary"
            fullWidth
            iconLeft="archive-restore"
            onPress={() => {
              if (move) useStore.getState().unarchiveMove(move.id);
              onClose();
            }}
          >
            Unarchive
          </Button>
        ) : (
          <Button
            variant="secondary"
            fullWidth
            iconLeft="archive"
            onPress={() => {
              if (move) useStore.getState().archiveMove(move.id);
              onClose();
            }}
          >
            Archive
          </Button>
        )}
        {move?.role === ROLES.owner && (
          <Button
            variant="danger"
            fullWidth
            iconLeft="trash"
            onPress={() => {
              if (move) onDelete(move);
            }}
          >
            Delete
          </Button>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  menuActions: { gap: space[3] },
});
