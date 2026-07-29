import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});
  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_newController.text != _confirmController.text) {
      setState(() => _error = 'New password and confirmation do not match.');
      return;
    }
    setState(() { _isSubmitting = true; _error = null; });
    try {
      final user = FirebaseAuth.instance.currentUser!;
      final cred = EmailAuthProvider.credential(email: user.email!, password: _currentController.text);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(_newController.text);
      await FirebaseFirestore.instance.collection('users').doc(user.uid).update({
        'mustChangePassword': false,
        'activatedAt': FieldValue.serverTimestamp(),
        'passwordChangedAt': FieldValue.serverTimestamp(),
      });
      ref.invalidate(authStateProvider);
    } on FirebaseAuthException catch (e) {
      setState(() => _error = e.code == 'invalid-credential' || e.code == 'wrong-password'
          ? 'Current password is incorrect.'
          : 'Could not update password: ${e.message}');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Change Your Password'), automaticallyImplyLeading: false),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              const Text('You must set a new password before continuing.'),
              const SizedBox(height: 16),
              TextFormField(
                controller: _currentController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Current (temporary) password'),
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              TextFormField(
                controller: _newController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'New password'),
                validator: (v) => (v == null || v.length < 8) ? 'At least 8 characters' : null,
              ),
              TextFormField(
                controller: _confirmController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Confirm new password'),
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              if (_error != null) Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                child: _isSubmitting ? const CircularProgressIndicator() : const Text('Update Password'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
