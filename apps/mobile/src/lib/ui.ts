import { StyleSheet } from 'react-native';

export const ui = StyleSheet.create({
  screen: { flex: 1, padding: 24, justifyContent: 'center', gap: 16, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '700', color: '#111' },
  body: { fontSize: 16, lineHeight: 22, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    color: '#111',
  },
  button: { backgroundColor: '#1a56db', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: { padding: 14, alignItems: 'center' },
  secondaryText: { color: '#1a56db', fontSize: 16 },
  error: { color: '#b91c1c', fontSize: 14 },
});
