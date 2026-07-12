// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'mood_log_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$MoodLogDto {

 String get id; DateTime get date; String get phase;// morning|evening|adhoc
 int get mood;// 0..4
 String? get note;
/// Create a copy of MoodLogDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MoodLogDtoCopyWith<MoodLogDto> get copyWith => _$MoodLogDtoCopyWithImpl<MoodLogDto>(this as MoodLogDto, _$identity);

  /// Serializes this MoodLogDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MoodLogDto&&(identical(other.id, id) || other.id == id)&&(identical(other.date, date) || other.date == date)&&(identical(other.phase, phase) || other.phase == phase)&&(identical(other.mood, mood) || other.mood == mood)&&(identical(other.note, note) || other.note == note));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,date,phase,mood,note);

@override
String toString() {
  return 'MoodLogDto(id: $id, date: $date, phase: $phase, mood: $mood, note: $note)';
}


}

/// @nodoc
abstract mixin class $MoodLogDtoCopyWith<$Res>  {
  factory $MoodLogDtoCopyWith(MoodLogDto value, $Res Function(MoodLogDto) _then) = _$MoodLogDtoCopyWithImpl;
@useResult
$Res call({
 String id, DateTime date, String phase, int mood, String? note
});




}
/// @nodoc
class _$MoodLogDtoCopyWithImpl<$Res>
    implements $MoodLogDtoCopyWith<$Res> {
  _$MoodLogDtoCopyWithImpl(this._self, this._then);

  final MoodLogDto _self;
  final $Res Function(MoodLogDto) _then;

/// Create a copy of MoodLogDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? date = null,Object? phase = null,Object? mood = null,Object? note = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as DateTime,phase: null == phase ? _self.phase : phase // ignore: cast_nullable_to_non_nullable
as String,mood: null == mood ? _self.mood : mood // ignore: cast_nullable_to_non_nullable
as int,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [MoodLogDto].
extension MoodLogDtoPatterns on MoodLogDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MoodLogDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MoodLogDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MoodLogDto value)  $default,){
final _that = this;
switch (_that) {
case _MoodLogDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MoodLogDto value)?  $default,){
final _that = this;
switch (_that) {
case _MoodLogDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  DateTime date,  String phase,  int mood,  String? note)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MoodLogDto() when $default != null:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  DateTime date,  String phase,  int mood,  String? note)  $default,) {final _that = this;
switch (_that) {
case _MoodLogDto():
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  DateTime date,  String phase,  int mood,  String? note)?  $default,) {final _that = this;
switch (_that) {
case _MoodLogDto() when $default != null:
return $default(_that.id,_that.date,_that.phase,_that.mood,_that.note);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _MoodLogDto implements MoodLogDto {
  const _MoodLogDto({required this.id, required this.date, required this.phase, required this.mood, this.note});
  factory _MoodLogDto.fromJson(Map<String, dynamic> json) => _$MoodLogDtoFromJson(json);

@override final  String id;
@override final  DateTime date;
@override final  String phase;
// morning|evening|adhoc
@override final  int mood;
// 0..4
@override final  String? note;

/// Create a copy of MoodLogDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MoodLogDtoCopyWith<_MoodLogDto> get copyWith => __$MoodLogDtoCopyWithImpl<_MoodLogDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MoodLogDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _MoodLogDto&&(identical(other.id, id) || other.id == id)&&(identical(other.date, date) || other.date == date)&&(identical(other.phase, phase) || other.phase == phase)&&(identical(other.mood, mood) || other.mood == mood)&&(identical(other.note, note) || other.note == note));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,date,phase,mood,note);

@override
String toString() {
  return 'MoodLogDto(id: $id, date: $date, phase: $phase, mood: $mood, note: $note)';
}


}

/// @nodoc
abstract mixin class _$MoodLogDtoCopyWith<$Res> implements $MoodLogDtoCopyWith<$Res> {
  factory _$MoodLogDtoCopyWith(_MoodLogDto value, $Res Function(_MoodLogDto) _then) = __$MoodLogDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, DateTime date, String phase, int mood, String? note
});




}
/// @nodoc
class __$MoodLogDtoCopyWithImpl<$Res>
    implements _$MoodLogDtoCopyWith<$Res> {
  __$MoodLogDtoCopyWithImpl(this._self, this._then);

  final _MoodLogDto _self;
  final $Res Function(_MoodLogDto) _then;

/// Create a copy of MoodLogDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? date = null,Object? phase = null,Object? mood = null,Object? note = freezed,}) {
  return _then(_MoodLogDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as DateTime,phase: null == phase ? _self.phase : phase // ignore: cast_nullable_to_non_nullable
as String,mood: null == mood ? _self.mood : mood // ignore: cast_nullable_to_non_nullable
as int,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
