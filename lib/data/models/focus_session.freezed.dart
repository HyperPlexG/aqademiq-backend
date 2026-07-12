// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'focus_session.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$FocusSession {

 String get id; int get durationMin; String? get taskId; String? get prismMode; int get elapsedSec; FocusStatus get status; DateTime? get startedAt; DateTime? get completedAt; int? get endMood;
/// Create a copy of FocusSession
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FocusSessionCopyWith<FocusSession> get copyWith => _$FocusSessionCopyWithImpl<FocusSession>(this as FocusSession, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FocusSession&&(identical(other.id, id) || other.id == id)&&(identical(other.durationMin, durationMin) || other.durationMin == durationMin)&&(identical(other.taskId, taskId) || other.taskId == taskId)&&(identical(other.prismMode, prismMode) || other.prismMode == prismMode)&&(identical(other.elapsedSec, elapsedSec) || other.elapsedSec == elapsedSec)&&(identical(other.status, status) || other.status == status)&&(identical(other.startedAt, startedAt) || other.startedAt == startedAt)&&(identical(other.completedAt, completedAt) || other.completedAt == completedAt)&&(identical(other.endMood, endMood) || other.endMood == endMood));
}


@override
int get hashCode => Object.hash(runtimeType,id,durationMin,taskId,prismMode,elapsedSec,status,startedAt,completedAt,endMood);

@override
String toString() {
  return 'FocusSession(id: $id, durationMin: $durationMin, taskId: $taskId, prismMode: $prismMode, elapsedSec: $elapsedSec, status: $status, startedAt: $startedAt, completedAt: $completedAt, endMood: $endMood)';
}


}

/// @nodoc
abstract mixin class $FocusSessionCopyWith<$Res>  {
  factory $FocusSessionCopyWith(FocusSession value, $Res Function(FocusSession) _then) = _$FocusSessionCopyWithImpl;
@useResult
$Res call({
 String id, int durationMin, String? taskId, String? prismMode, int elapsedSec, FocusStatus status, DateTime? startedAt, DateTime? completedAt, int? endMood
});




}
/// @nodoc
class _$FocusSessionCopyWithImpl<$Res>
    implements $FocusSessionCopyWith<$Res> {
  _$FocusSessionCopyWithImpl(this._self, this._then);

  final FocusSession _self;
  final $Res Function(FocusSession) _then;

/// Create a copy of FocusSession
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? durationMin = null,Object? taskId = freezed,Object? prismMode = freezed,Object? elapsedSec = null,Object? status = null,Object? startedAt = freezed,Object? completedAt = freezed,Object? endMood = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,durationMin: null == durationMin ? _self.durationMin : durationMin // ignore: cast_nullable_to_non_nullable
as int,taskId: freezed == taskId ? _self.taskId : taskId // ignore: cast_nullable_to_non_nullable
as String?,prismMode: freezed == prismMode ? _self.prismMode : prismMode // ignore: cast_nullable_to_non_nullable
as String?,elapsedSec: null == elapsedSec ? _self.elapsedSec : elapsedSec // ignore: cast_nullable_to_non_nullable
as int,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as FocusStatus,startedAt: freezed == startedAt ? _self.startedAt : startedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,completedAt: freezed == completedAt ? _self.completedAt : completedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,endMood: freezed == endMood ? _self.endMood : endMood // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [FocusSession].
extension FocusSessionPatterns on FocusSession {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FocusSession value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FocusSession() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FocusSession value)  $default,){
final _that = this;
switch (_that) {
case _FocusSession():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FocusSession value)?  $default,){
final _that = this;
switch (_that) {
case _FocusSession() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  int durationMin,  String? taskId,  String? prismMode,  int elapsedSec,  FocusStatus status,  DateTime? startedAt,  DateTime? completedAt,  int? endMood)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FocusSession() when $default != null:
return $default(_that.id,_that.durationMin,_that.taskId,_that.prismMode,_that.elapsedSec,_that.status,_that.startedAt,_that.completedAt,_that.endMood);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  int durationMin,  String? taskId,  String? prismMode,  int elapsedSec,  FocusStatus status,  DateTime? startedAt,  DateTime? completedAt,  int? endMood)  $default,) {final _that = this;
switch (_that) {
case _FocusSession():
return $default(_that.id,_that.durationMin,_that.taskId,_that.prismMode,_that.elapsedSec,_that.status,_that.startedAt,_that.completedAt,_that.endMood);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  int durationMin,  String? taskId,  String? prismMode,  int elapsedSec,  FocusStatus status,  DateTime? startedAt,  DateTime? completedAt,  int? endMood)?  $default,) {final _that = this;
switch (_that) {
case _FocusSession() when $default != null:
return $default(_that.id,_that.durationMin,_that.taskId,_that.prismMode,_that.elapsedSec,_that.status,_that.startedAt,_that.completedAt,_that.endMood);case _:
  return null;

}
}

}

/// @nodoc


class _FocusSession extends FocusSession {
  const _FocusSession({required this.id, required this.durationMin, this.taskId, this.prismMode, this.elapsedSec = 0, this.status = FocusStatus.idle, this.startedAt, this.completedAt, this.endMood}): super._();
  

@override final  String id;
@override final  int durationMin;
@override final  String? taskId;
@override final  String? prismMode;
@override@JsonKey() final  int elapsedSec;
@override@JsonKey() final  FocusStatus status;
@override final  DateTime? startedAt;
@override final  DateTime? completedAt;
@override final  int? endMood;

/// Create a copy of FocusSession
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FocusSessionCopyWith<_FocusSession> get copyWith => __$FocusSessionCopyWithImpl<_FocusSession>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FocusSession&&(identical(other.id, id) || other.id == id)&&(identical(other.durationMin, durationMin) || other.durationMin == durationMin)&&(identical(other.taskId, taskId) || other.taskId == taskId)&&(identical(other.prismMode, prismMode) || other.prismMode == prismMode)&&(identical(other.elapsedSec, elapsedSec) || other.elapsedSec == elapsedSec)&&(identical(other.status, status) || other.status == status)&&(identical(other.startedAt, startedAt) || other.startedAt == startedAt)&&(identical(other.completedAt, completedAt) || other.completedAt == completedAt)&&(identical(other.endMood, endMood) || other.endMood == endMood));
}


@override
int get hashCode => Object.hash(runtimeType,id,durationMin,taskId,prismMode,elapsedSec,status,startedAt,completedAt,endMood);

@override
String toString() {
  return 'FocusSession(id: $id, durationMin: $durationMin, taskId: $taskId, prismMode: $prismMode, elapsedSec: $elapsedSec, status: $status, startedAt: $startedAt, completedAt: $completedAt, endMood: $endMood)';
}


}

/// @nodoc
abstract mixin class _$FocusSessionCopyWith<$Res> implements $FocusSessionCopyWith<$Res> {
  factory _$FocusSessionCopyWith(_FocusSession value, $Res Function(_FocusSession) _then) = __$FocusSessionCopyWithImpl;
@override @useResult
$Res call({
 String id, int durationMin, String? taskId, String? prismMode, int elapsedSec, FocusStatus status, DateTime? startedAt, DateTime? completedAt, int? endMood
});




}
/// @nodoc
class __$FocusSessionCopyWithImpl<$Res>
    implements _$FocusSessionCopyWith<$Res> {
  __$FocusSessionCopyWithImpl(this._self, this._then);

  final _FocusSession _self;
  final $Res Function(_FocusSession) _then;

/// Create a copy of FocusSession
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? durationMin = null,Object? taskId = freezed,Object? prismMode = freezed,Object? elapsedSec = null,Object? status = null,Object? startedAt = freezed,Object? completedAt = freezed,Object? endMood = freezed,}) {
  return _then(_FocusSession(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,durationMin: null == durationMin ? _self.durationMin : durationMin // ignore: cast_nullable_to_non_nullable
as int,taskId: freezed == taskId ? _self.taskId : taskId // ignore: cast_nullable_to_non_nullable
as String?,prismMode: freezed == prismMode ? _self.prismMode : prismMode // ignore: cast_nullable_to_non_nullable
as String?,elapsedSec: null == elapsedSec ? _self.elapsedSec : elapsedSec // ignore: cast_nullable_to_non_nullable
as int,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as FocusStatus,startedAt: freezed == startedAt ? _self.startedAt : startedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,completedAt: freezed == completedAt ? _self.completedAt : completedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,endMood: freezed == endMood ? _self.endMood : endMood // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}

// dart format on
