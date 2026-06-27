import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Riverpod-based state machine for scholar UI
/// Handles state transitions with constraints and lifecycle management

enum ScholarAppState {
  initial,
  loading,
  authenticated,
  viewingDashboard,
  viewingRequirements,
  uploadingDocument,
  syncing,
  offline,
  error,
  disposed,
}

/// Scholar-specific lifecycle constraints
class ScholarLifecycleConstraints {
  /// Can only view documents when authenticated
  static bool canViewDocuments(ScholarAppState state) {
    return state == ScholarAppState.authenticated ||
        state == ScholarAppState.viewingRequirements ||
        state == ScholarAppState.offline;
  }

  /// Can only upload when authenticated and online
  static bool canUploadDocuments(ScholarAppState state) {
    return state == ScholarAppState.authenticated ||
        state == ScholarAppState.viewingRequirements;
  }

  /// Can sync only when authenticated
  static bool canSync(ScholarAppState state) {
    return state == ScholarAppState.authenticated || state == ScholarAppState.syncing;
  }

  /// Is operational
  static bool isOperational(ScholarAppState state) {
    return state != ScholarAppState.disposed &&
        state != ScholarAppState.error;
  }
}

/// Scholar state machine context
class ScholarStateMachineContext {
  final ScholarAppState previousState;
  final ScholarAppState currentState;
  final String? errorMessage;
  final dynamic errorData;
  final Map<String, dynamic> metadata;

  const ScholarStateMachineContext({
    required this.previousState,
    required this.currentState,
    this.errorMessage,
    this.errorData,
    this.metadata = const {},
  });

  ScholarStateMachineContext copyWith({
    ScholarAppState? previousState,
    ScholarAppState? currentState,
    String? errorMessage,
    dynamic errorData,
    Map<String, dynamic>? metadata,
  }) {
    return ScholarStateMachineContext(
      previousState: previousState ?? this.previousState,
      currentState: currentState ?? this.currentState,
      errorMessage: errorMessage ?? this.errorMessage,
      errorData: errorData ?? this.errorData,
      metadata: metadata ?? this.metadata,
    );
  }
}

/// Valid transitions for scholar state machine
const scholarValidTransitions = {
  ScholarAppState.initial: {ScholarAppState.loading},
  ScholarAppState.loading: {
    ScholarAppState.authenticated,
    ScholarAppState.error,
  },
  ScholarAppState.authenticated: {
    ScholarAppState.viewingDashboard,
    ScholarAppState.viewingRequirements,
    ScholarAppState.offline,
    ScholarAppState.error,
  },
  ScholarAppState.viewingDashboard: {
    ScholarAppState.viewingRequirements,
    ScholarAppState.syncing,
    ScholarAppState.offline,
    ScholarAppState.error,
  },
  ScholarAppState.viewingRequirements: {
    ScholarAppState.uploadingDocument,
    ScholarAppState.syncing,
    ScholarAppState.offline,
    ScholarAppState.error,
  },
  ScholarAppState.uploadingDocument: {
    ScholarAppState.syncing,
    ScholarAppState.offline,
    ScholarAppState.error,
  },
  ScholarAppState.syncing: {
    ScholarAppState.authenticated,
    ScholarAppState.offline,
    ScholarAppState.error,
  },
  ScholarAppState.offline: {
    ScholarAppState.authenticated,
    ScholarAppState.viewingDashboard,
    ScholarAppState.viewingRequirements,
    ScholarAppState.syncing,
    ScholarAppState.error,
  },
  ScholarAppState.error: {
    ScholarAppState.authenticated,
    ScholarAppState.loading,
    ScholarAppState.disposed,
  },
  ScholarAppState.disposed: <ScholarAppState>{},
};

/// Notifier for scholar state machine
class ScholarStateMachineNotifier extends StateNotifier<ScholarStateMachineContext> {
  ScholarStateMachineNotifier()
      : super(
    const ScholarStateMachineContext(
      previousState: ScholarAppState.initial,
      currentState: ScholarAppState.initial,
    ),
  );

  /// Transition to new state
  Future<bool> transitionTo(
    ScholarAppState newState, {
    String? reason,
    Map<String, dynamic>? metadata,
  }) async {
    final currentState = state.currentState;

    // Validate transition
    final validStates = scholarValidTransitions[currentState];
    if (validStates == null || !validStates.contains(newState)) {
      // ignore: avoid_print
      print('Invalid transition: $currentState → $newState');
      return false;
    }

    // Update state
    state = state.copyWith(
      previousState: currentState,
      currentState: newState,
      errorMessage: null,
      metadata: metadata,
    );

    return true;
  }

  /// Set error state
  Future<bool> setError(String message, {dynamic errorData}) async {
    state = state.copyWith(
      previousState: state.currentState,
      currentState: ScholarAppState.error,
      errorMessage: message,
      errorData: errorData,
    );
    return true;
  }

  /// Recover from error
  Future<bool> recoverFromError(ScholarAppState targetState) async {
    if (state.currentState != ScholarAppState.error) {
      return false;
    }

    return transitionTo(
      targetState,
      reason: 'Recovered from error',
    );
  }

  /// Check if can transition
  bool canTransitionTo(ScholarAppState targetState) {
    final validStates = scholarValidTransitions[state.currentState];
    return validStates != null && validStates.contains(targetState);
  }

  /// Reset to initial
  void reset() {
    state = const ScholarStateMachineContext(
      previousState: ScholarAppState.initial,
      currentState: ScholarAppState.initial,
    );
  }
}

/// Provider for scholar state machine
final scholarStateMachineProvider =
    StateNotifierProvider<ScholarStateMachineNotifier, ScholarStateMachineContext>(
  (ref) => ScholarStateMachineNotifier(),
);

/// Selector for current state
final scholarCurrentStateProvider = Provider(
  (ref) => ref.watch(scholarStateMachineProvider).currentState,
);

/// Selector for is operational
final scholarIsOperationalProvider = Provider(
  (ref) {
    final state = ref.watch(scholarCurrentStateProvider);
    return ScholarLifecycleConstraints.isOperational(state);
  },
);

/// Selector for error
final scholarErrorProvider = Provider(
  (ref) => ref.watch(scholarStateMachineProvider).errorMessage,
);

/// Can perform action checks
final scholarCanUploadProvider = Provider(
  (ref) {
    final state = ref.watch(scholarCurrentStateProvider);
    return ScholarLifecycleConstraints.canUploadDocuments(state);
  },
);

final scholarCanSyncProvider = Provider(
  (ref) {
    final state = ref.watch(scholarCurrentStateProvider);
    return ScholarLifecycleConstraints.canSync(state);
  },
);

final scholarCanViewDocumentsProvider = Provider(
  (ref) {
    final state = ref.watch(scholarCurrentStateProvider);
    return ScholarLifecycleConstraints.canViewDocuments(state);
  },
);
