import { CanDeactivateFn } from '@angular/router';

import { HasUnsavedChanges } from './content-editor.base';

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() || confirm('You have unsaved changes. Leave without saving?');
