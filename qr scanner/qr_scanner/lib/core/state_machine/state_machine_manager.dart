import 'package:flutter/foundation.dart';
import 'app_state_machine.dart';

/// State machine manager for enforcing transitions and lifecycle constraints
class StateMachineManager extends ChangeNotifier {
  AppState _currentState = AppState.initial;
  AppState _previousState = AppState.initial;
  String? _currentError;
  dynamic _errorData;
  final List<StateTransition> _transitionHistory = [];
  final List<StateChangeListener> _listeners = [];
  final List<TransitionValidator> _validators = [];

  AppState get currentState => _currentState;
  AppState get previousState => _previousState;
  String? get currentError => _currentError;
  List<StateTransition> get transitionHistory => List.unmodifiable(_transitionHistory);
  bool get isOperational => LifecycleConstraints.isOperational(_currentState);
  bool get isTerminal => LifecycleConstraints.isTerminal(_currentState);

  /// Get current context
  StateMachineContext get context => StateMachineContext(
    previousState: _previousState,
    currentState: _currentState,
    errorMessage: _currentError,
    errorData: _errorData,
    transitionHistory: List.unmodifiable(_transitionHistory),
  );

  /// Register a state change listener
  void addStateListener(StateChangeListener listener) {
    _listeners.add(listener);
  }

  /// Remove a state change listener
  void removeStateListener(StateChangeListener listener) {
    _listeners.remove(listener);
  }

  /// Register a transition validator
  void addTransitionValidator(TransitionValidator validator) {
    _validators.add(validator);
  }

  /// Attempt to transition to a new state
  /// Validates against state machine rules and all registered validators
  Future<bool> transitionTo(
    AppState newState, {
    String? reason,
    Map<String, dynamic>? metadata,
  }) async {
    // Cannot transition from terminal state
    if (isTerminal) {
      _logWarning('Cannot transition from terminal state $currentState');
      return false;
    }

    // Validate transition is allowed by state machine
    if (!StateTransitionRules.isValidTransition(_currentState, newState)) {
      _logWarning(
        'Invalid transition: $_currentState → $newState. '
        'Valid next states: ${StateTransitionRules.getValidNextStates(_currentState)}',
      );
      return false;
    }

    // Run all registered validators
    for (final validator in _validators) {
      try {
        final isValid = await validator(_currentState, newState);
        if (!isValid) {
          _logWarning('Transition validator rejected: $_currentState → $newState');
          return false;
        }
      } catch (e) {
        _logError('Transition validator error: $e');
        return false;
      }
    }

    // Perform transition
    _previousState = _currentState;
    _currentState = newState;
    _currentError = null; // Clear error on successful transition
    _errorData = null;

    final transition = StateTransition(
      from: _previousState,
      to: _currentState,
      reason: reason,
    );
    _transitionHistory.add(transition);

    _logInfo('Transition successful: $transition');

    // Notify listeners
    final updatedContext = context;
    for (final listener in _listeners) {
      try {
        listener(updatedContext);
      } catch (e) {
        _logError('Error in state listener: $e');
      }
    }

    // Notify ChangeNotifier listeners
    notifyListeners();

    return true;
  }

  /// Set error state with optional error message and data
  Future<bool> setError(String message, {dynamic errorData}) async {
    _currentError = message;
    _errorData = errorData;

    final success = await transitionTo(
      AppState.error,
      reason: 'Error state: $message',
    );

    if (!success) {
      _logError('Failed to transition to error state: $message');
    }

    return success;
  }

  /// Attempt to recover from error state
  Future<bool> recoverFromError({required AppState targetState}) async {
    if (!LifecycleConstraints.canRecoverFromError(_currentState)) {
      _logWarning('Cannot recover: not in error state');
      return false;
    }

    _currentError = null;
    _errorData = null;

    return transitionTo(
      targetState,
      reason: 'Recovered from error',
    );
  }

  /// Check if a transition would be valid (without performing it)
  bool canTransitionTo(AppState targetState) {
    if (isTerminal) return false;
    return StateTransitionRules.isValidTransition(_currentState, targetState);
  }

  /// Get all possible valid next states
  Set<AppState> getValidNextStates() {
    return StateTransitionRules.getValidNextStates(_currentState);
  }

  /// Reset state machine to initial state
  void reset() {
    _currentState = AppState.initial;
    _previousState = AppState.initial;
    _currentError = null;
    _errorData = null;
    _transitionHistory.clear();
    _logInfo('State machine reset to initial state');
    notifyListeners();
  }

  /// Clear transition history
  void clearHistory() {
    _transitionHistory.clear();
  }

  /// Dispose state machine
  @override
  void dispose() async {
    await transitionTo(AppState.disposed, reason: 'State machine disposed');
    _listeners.clear();
    _validators.clear();
    super.dispose();
  }

  // Logging utilities
  void _logInfo(String message) {
    if (kDebugMode) {
      print('[StateMachine] INFO: $message');
    }
  }

  void _logWarning(String message) {
    if (kDebugMode) {
      print('[StateMachine] WARNING: $message');
    }
  }

  void _logError(String message) {
    if (kDebugMode) {
      print('[StateMachine] ERROR: $message');
    }
  }
}
