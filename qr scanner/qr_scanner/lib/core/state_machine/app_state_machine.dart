/// Defines all possible application states
enum AppState {
  /// Initial state - app just started
  initial,

  /// Firebase and services initializing
  initializing,

  /// User authentication required
  unauthenticated,

  /// User authenticated, ready for operations
  authenticated,

  /// In scanning mode (QR scanner)
  scanning,

  /// Processing scanned data
  processing,

  /// Syncing data with backend
  syncing,

  /// Offline mode active
  offline,

  /// Error state
  error,

  /// Disposed/cleaned up
  disposed,
}

/// Represents a state machine transition
class StateTransition {
  final AppState from;
  final AppState to;
  final String? reason;
  final DateTime timestamp;

  StateTransition({
    required this.from,
    required this.to,
    this.reason,
  }) : timestamp = DateTime.now();

  @override
  String toString() => 'Transition($from → $to at $timestamp)${reason != null ? ' - Reason: $reason' : ''}';
}

/// Configuration for valid state transitions
class StateTransitionRules {
  static const Map<AppState, Set<AppState>> validTransitions = {
    AppState.initial: {AppState.initializing},
    AppState.initializing: {
      AppState.unauthenticated,
      AppState.authenticated,
      AppState.error,
    },
    AppState.unauthenticated: {
      AppState.authenticated,
      AppState.error,
      AppState.disposed,
    },
    AppState.authenticated: {
      AppState.scanning,
      AppState.syncing,
      AppState.offline,
      AppState.error,
      AppState.disposed,
    },
    AppState.scanning: {
      AppState.processing,
      AppState.offline,
      AppState.error,
    },
    AppState.processing: {
      AppState.syncing,
      AppState.offline,
      AppState.error,
    },
    AppState.syncing: {
      AppState.authenticated,
      AppState.offline,
      AppState.error,
    },
    AppState.offline: {
      AppState.scanning,
      AppState.syncing,
      AppState.authenticated,
      AppState.error,
    },
    AppState.error: {
      AppState.authenticated,
      AppState.initializing,
      AppState.disposed,
    },
    AppState.disposed: <AppState>{}, // No transitions from disposed
  };

  /// Validates if transition from [fromState] to [toState] is allowed
  static bool isValidTransition(AppState fromState, AppState toState) {
    final allowedStates = validTransitions[fromState];
    return allowedStates != null && allowedStates.contains(toState);
  }

  /// Gets all valid next states for [currentState]
  static Set<AppState> getValidNextStates(AppState currentState) {
    return validTransitions[currentState] ?? {};
  }
}

/// Lifecycle constraints and rules
class LifecycleConstraints {
  /// Cannot process while offline
  static bool canProcess(AppState currentState) {
    return currentState != AppState.offline && currentState != AppState.disposed;
  }

  /// Cannot sync while not authenticated
  static bool canSync(AppState currentState) {
    return currentState == AppState.authenticated ||
        currentState == AppState.syncing;
  }

  /// Can only scan if authenticated and not disposed
  static bool canScan(AppState currentState) {
    return currentState == AppState.authenticated ||
        currentState == AppState.scanning ||
        currentState == AppState.offline;
  }

  /// Can recover from error state
  static bool canRecoverFromError(AppState currentState) {
    return currentState == AppState.error;
  }

  /// Is in a terminal state (cannot transition further)
  static bool isTerminal(AppState state) {
    return state == AppState.disposed;
  }

  /// Is in an operational state
  static bool isOperational(AppState state) {
    return state == AppState.authenticated ||
        state == AppState.scanning ||
        state == AppState.offline;
  }
}

/// State machine context carrying metadata about state changes
class StateMachineContext {
  final AppState previousState;
  final AppState currentState;
  final String? errorMessage;
  final dynamic errorData;
  final Map<String, dynamic> metadata;
  final List<StateTransition> transitionHistory;

  const StateMachineContext({
    required this.previousState,
    required this.currentState,
    this.errorMessage,
    this.errorData,
    this.metadata = const {},
    this.transitionHistory = const [],
  });

  /// Copy with modifications
  StateMachineContext copyWith({
    AppState? previousState,
    AppState? currentState,
    String? errorMessage,
    dynamic errorData,
    Map<String, dynamic>? metadata,
    List<StateTransition>? transitionHistory,
  }) {
    return StateMachineContext(
      previousState: previousState ?? this.previousState,
      currentState: currentState ?? this.currentState,
      errorMessage: errorMessage ?? this.errorMessage,
      errorData: errorData ?? this.errorData,
      metadata: metadata ?? this.metadata,
      transitionHistory: transitionHistory ?? this.transitionHistory,
    );
  }

  @override
  String toString() => 'StateMachineContext(state: $currentState, error: $errorMessage)';
}

/// Listener for state changes
typedef StateChangeListener = void Function(StateMachineContext context);

/// Validator for state transitions
typedef TransitionValidator = Future<bool> Function(AppState from, AppState to);
