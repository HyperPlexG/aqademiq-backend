// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'mood_log.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$MoodLog {

 String get id; DateTime get date; MoodPhase get phase; int get mood; String? get note;
/// Create a copy of MoodLog
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MoodLogCopyWith<MoodLog> get copyWith => _$MoodLogCopyWithImpl<MoodLog>(this as MoodLog, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MoodLog&&(identical(other.id, id) || other.id == id)&&(identical(other.date, date) || other.date == date)&&(identical(other.phase, phase) || other.phase == phase)&&(identical(other.mood, mood) || other.mood == mood)&&(identical(other.note, note) || other.note == note));
}


@override
int get hashCode => Object.hash(runtimeType,id,date,phase,mood,note);

@override
String toString() {
  return 'MoodLog(id: $id, date: $date, phase: $phase, mood: $mood, note: $note)';
}


}

/// @nodoc
abstract mixin class $MoodLogCopyWith<$Res>  {
  factory $MoodLogCopyWith(MoodLog value, $Res Function(MoodLog) _then) = _$MoodLogCopyWithImpl;
@useResult
$Res call({
 String id, DateTime date, MoodPhase phase, int mood, String? note
});




}
/// @nodoc
class _$MoodLogCopyWithImpl<$Res>
    implements $MoodLogCopyWith<$Res> {
  _$MoodLogCopyWithImpl(this._self, this._then);

  final MoodLog _self;
  final $Res Function(MoodLog) _then;

/// Create a copy of MoodLog
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? date = null,Object? phase = null,Object? mood = null,Object? note = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as DateTime,phase: null == phase ? _self.phase : phase // ignore: cast_nullable_to_non_nullable
as MoodPhase,mood: null == mood ? _self.mood : mood // ignore: cast_nullable_to_non_nullable
as int,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [MoodLog].
extension MoodLogPatterns on MoodLog {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MoodLog value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MoodLog() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MoodLog value)  $default,){
final _that = this;
switch (_that) {
case _MoodLog():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MoodLog value)?  $default,){
final _that = this;
switch (_that) {
case _MoodLog() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  DateTime date,  MoodPhase phase,  int mood,  String? note)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MoodLog() when $default != null:
return $default(_that.id,_that.date,_that.phase,_that.mood,_that.note);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  DateTime date,  MoodPhase phase,  int mood,  String? note)  $default,) {final _that = this;
switch (_that) {
case _MoodLog():
return $default(_that.id,_that.date,_that.phase,_that.mood,_that.note);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  DateTime date,  MoodPhase phase,  int mood,  String? note)?  $default,) {final _that = this;
switch (_that) {
case _MoodLog() when $default != null:
return $default(_that.id,_that.date,_that.phase,_that.mood,_that.note);case _:
  return null;

}
}

}

/// @nodoc


class _MoodLog implements MoodLog {
  const _MoodLog({required this.id, required this.date, required this.phase, required this.mood, this.note});
  

@override final  String id;
@override final  DateTime date;
@override final  MoodPhase phase;
@override final  int mood;
@override final  String? note;

/// Create a copy of MoodLog
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MoodLogCopyWith<_MoodLog> get copyWith => __$MoodLogCopyWithImpl<_MoodLog>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _MoodLog&&(identical(other.id, id) || other.id == id)&&(identical(other.date, date) || other.date == date)&&(identical(other.phase, phase) || other.phase == phase)&&(identical(other.mood, mood) || other.mood == mood)&&(identical(other.note, note) || other.note == note));
}


@override
int get hashCode => Object.hash(runtimeType,id,date,phase,mood,note);

@override
String toString() {
  return 'MoodLog(id: $id, date: $date, phase: $phase, mood: $mood, note: $note)';
}


}

/// @nodoc
abstract mixin class _$MoodLogCopyWith<$Res> implements $MoodLogCopyWith<$Res> {
  factory _$MoodLogCopyWith(_MoodLog value, $Res Function(_MoodLog) _then) = __$MoodLogCopyWithImpl;
@override @useResult
$Res call({
 String id, DateTime date, MoodPhase phase, int mood, String? note
});




}
/// @nodoc
class __$MoodLogCopyWithImpl<$Res>
    implements _$MoodLogCopyWith<$Res> {
  __$MoodLogCopyWithImpl(this._self, this._then);

  final _MoodLog _self;
  final $Res Function(_MoodLog) _then;

/// Create a copy of MoodLog
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? date = null,Object? phase = null,Object? mood = null,Object? note = freezed,}) {
  return _then(_MoodLog(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as DateTime,phase: null == phase ? _self.phase : phase // ignore: cast_nullable_to_non_nullable
as MoodPhase,mood: null == mood ? _self.mood : mood // ignore: cast_nullable_to_non_nullable
as int,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
