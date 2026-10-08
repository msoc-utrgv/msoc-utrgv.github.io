// Drag-and-drop reordering for the direct children of a container.
// onMove(from, to) is called with the old index and the new index.

export function sortable(container, { handle, onMove, horizontal = false }) {
  let dragged = null;

  const itemAt = (target) => [...container.children].find((child) => child.contains(target));

  const clearMarkers = () => {
    for (const child of container.children) child.classList.remove('drop-before', 'drop-after');
  };

  container.addEventListener('dragstart', (event) => {
    const grip = event.target.closest?.(handle);
    const item = grip && itemAt(grip);
    // Ignore drags that belong to a nested sortable list.
    if (!item || grip.closest('[data-sortable]') !== container) return;
    dragged = item;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', '');
    event.dataTransfer.setDragImage(item, 16, 16);
    requestAnimationFrame(() => item.classList.add('dragging'));
  });

  container.addEventListener('dragover', (event) => {
    if (!dragged) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    clearMarkers();
    const over = itemAt(event.target);
    if (!over || over === dragged) return;
    const box = over.getBoundingClientRect();
    const after = horizontal
      ? event.clientX > box.left + box.width / 2
      : event.clientY > box.top + box.height / 2;
    over.classList.add(after ? 'drop-after' : 'drop-before');
  });

  container.addEventListener('drop', (event) => {
    if (!dragged) return;
    event.preventDefault();
    event.stopPropagation();
    const children = [...container.children];
    const over = children.find((child) => child.classList.contains('drop-before') || child.classList.contains('drop-after'));
    if (over) {
      const from = children.indexOf(dragged);
      let to = children.indexOf(over) + (over.classList.contains('drop-after') ? 1 : 0);
      if (from < to) to -= 1;
      if (from !== to) onMove(from, to);
    }
  });

  container.addEventListener('dragend', () => {
    dragged?.classList.remove('dragging');
    dragged = null;
    clearMarkers();
  });

  container.dataset.sortable = '';
}

export function moveItem(array, from, to) {
  const [item] = array.splice(from, 1);
  array.splice(to, 0, item);
}
