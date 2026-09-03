export const EVENTS = {
  HAND_TRACKING: {
    HANDS_DETECTED: 'hands:detected',
    HAND_LOST: 'hands:lost',
    TRACKING_ERROR: 'hands:tracking_error',
    CALIBRATION_UPDATED: 'hands:calibration_updated',
  },
  GESTURE: {
    GESTURE_RECOGNIZED: 'gesture:recognized',
    GESTURE_STATE_CHANGED: 'gesture:state_changed',
    GESTURE_TRANSITION: 'gesture:transition',
  },
  INTERACTION: {
    HOVER_START: 'interaction:hover_start',
    HOVER_END: 'interaction:hover_end',
    SELECT_START: 'interaction:select_start',
    SELECT_END: 'interaction:select_end',
    TRANSFORM_START: 'interaction:transform_start',
    TRANSFORM_UPDATE: 'interaction:transform_update',
    TRANSFORM_END: 'interaction:transform_end',
    MODE_CHANGED: 'interaction:mode_changed',
    CURSOR_UPDATE: 'interaction:cursor_update',
  },
  SCENE: {
    OBJECT_ADDED: 'scene:object_added',
    OBJECT_REMOVED: 'scene:object_removed',
    OBJECT_SELECTED: 'scene:object_selected',
    OBJECT_DESELECTED: 'scene:object_deselected',
    OBJECT_TRANSFORMED: 'scene:object_transformed',
    SCENE_CHANGED: 'scene:scene_changed',
  },
  UNDO_REDO: {
    HISTORY_CHANGED: 'history:changed',
    COMMAND_EXECUTED: 'history:command_executed',
  },
  PROJECT: {
    PROJECT_CREATED: 'project:created',
    PROJECT_LOADED: 'project:loaded',
    PROJECT_SAVED: 'project:saved',
    PROJECT_EXPORTED: 'project:exported',
  },
  SYSTEM: {
    SETTINGS_CHANGED: 'system:settings_changed',
    CAMERA_STATUS_CHANGED: 'system:camera_status_changed',
    DEBUG_TOGGLED: 'system:debug_toggled',
  },
} as const;

export type EventType = (typeof EVENTS)[keyof typeof EVENTS][keyof (typeof EVENTS)[keyof typeof EVENTS]];
