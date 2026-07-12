import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Open a URL (web link or mailto) in the platform handler, surfacing a snackbar
/// if no handler is available. Shared by Settings (Privacy/Terms), Stats links,
/// and feedback. Real destinations land in the §8 pass; the seam is here now.
Future<void> openExternal(BuildContext context, Uri uri) async {
  final messenger = ScaffoldMessenger.of(context);
  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok) {
    messenger.showSnackBar(
      SnackBar(content: Text('Could not open ${uri.scheme == 'mailto' ? 'mail' : 'the link'}')),
    );
  }
}
