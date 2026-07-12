// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'task_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SubtaskDto {

 String get id; String get title; bool get done;
/// Create a copy of SubtaskDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SubtaskDtoCopyWith<SubtaskDto> get copyWith => _$SubtaskDtoCopyWithImpl<SubtaskDto>(this as SubtaskDto, _$identity);

  /// Serializes this SubtaskDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SubtaskDto&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.done, done) || other.done == done));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,done);

@override
String toString() {
  return 'SubtaskDto(id: $id, title: $title, done: $done)';
}


}

/// @nodoc
abstract mixin class $SubtaskDtoCopyWith<$Res>  {
  factory $SubtaskDtoCopyWith(SubtaskDto value, $Res Function(SubtaskDto) _then) = _$SubtaskDtoCopyWithImpl;
@useResult
$Res call({
 String id, String title, bool done
});




}
/// @nodoc
class _$SubtaskDtoCopyWithImpl<$Res>
    implements $SubtaskDtoCopyWith<$Res> {
  _$SubtaskDtoCopyWithImpl(this._self, this._then);

  final SubtaskDto _self;
  final $Res Function(SubtaskDto) _then;

/// Create a copy of SubtaskDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? title = null,Object? done = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,done: null == done ? _self.done : done // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [SubtaskDto].
extension SubtaskDtoPatterns on SubtaskDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SubtaskDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SubtaskDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SubtaskDto value)  $default,){
final _that = this;
switch (_that) {
case _SubtaskDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SubtaskDto value)?  $default,){
final _that = this;
switch (_that) {
case _SubtaskDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String title,  bool done)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SubtaskDto() when $default != null:
return $default(_that.id,_that.title,_that.done);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String title,  bool done)  $default,) {final _that = this;
switch (_that) {
case _SubtaskDto():
return $default(_that.id,_that.title,_that.done);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String title,  bool done)?  $default,) {final _that = this;
switch (_that) {
case _SubtaskDto() when $default != null:
return $default(_that.id,_that.title,_that.done);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SubtaskDto implements SubtaskDto {
  const _SubtaskDto({required this.id, required this.title, this.done = false});
  factory _SubtaskDto.fromJson(Map<String, dynamic> json) => _$SubtaskDtoFromJson(json);

@override final  String id;
@override final  String title;
@override@JsonKey() final  bool done;

/// Create a copy of SubtaskDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SubtaskDtoCopyWith<_SubtaskDto> get copyWith => __$SubtaskDtoCopyWithImpl<_SubtaskDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SubtaskDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SubtaskDto&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.done, done) || other.done == done));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,done);

@override
String toString() {
  return 'SubtaskDto(id: $id, title: $title, done: $done)';
}


}

/// @nodoc
abstract mixin class _$SubtaskDtoCopyWith<$Res> implements $SubtaskDtoCopyWith<$Res> {
  factory _$SubtaskDtoCopyWith(_SubtaskDto value, $Res Function(_SubtaskDto) _then) = __$SubtaskDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String title, bool done
});




}
/// @nodoc
class __$SubtaskDtoCopyWithImpl<$Res>
    implements _$SubtaskDtoCopyWith<$Res> {
  __$SubtaskDtoCopyWithImpl(this._self, this._then);

  final _SubtaskDto _self;
  final $Res Function(_SubtaskDto) _then;

/// Create a copy of SubtaskDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? title = null,Object? done = null,}) {
  return _then(_SubtaskDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,done: null == done ? _self.done : done // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$RepeatRuleDto {

 String get frequency;// none|daily|weekly|monthly|custom
 int get interval; List<int> get weekdays;
/// Create a copy of RepeatRuleDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RepeatRuleDtoCopyWith<RepeatRuleDto> get copyWith => _$RepeatRuleDtoCopyWithImpl<RepeatRuleDto>(this as RepeatRuleDto, _$identity);

  /// Serializes this RepeatRuleDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RepeatRuleDto&&(identical(other.frequency, frequency) || other.frequency == frequency)&&(identical(other.interval, interval) || other.interval == interval)&&const DeepCollectionEquality().equals(other.weekdays, weekdays));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,frequency,interval,const DeepCollectionEquality().hash(weekdays));

@override
String toString() {
  return 'RepeatRuleDto(frequency: $frequency, interval: $interval, weekdays: $weekdays)';
}


}

/// @nodoc
abstract mixin class $RepeatRuleDtoCopyWith<$Res>  {
  factory $RepeatRuleDtoCopyWith(RepeatRuleDto value, $Res Function(RepeatRuleDto) _then) = _$RepeatRuleDtoCopyWithImpl;
@useResult
$Res call({
 String frequency, int interval, List<int> weekdays
});




}
/// @nodoc
class _$RepeatRuleDtoCopyWithImpl<$Res>
    implements $RepeatRuleDtoCopyWith<$Res> {
  _$RepeatRuleDtoCopyWithImpl(this._self, this._then);

  final RepeatRuleDto _self;
  final $Res Function(RepeatRuleDto) _then;

/// Create a copy of RepeatRuleDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? frequency = null,Object? interval = null,Object? weekdays = null,}) {
  return _then(_self.copyWith(
frequency: null == frequency ? _self.frequency : frequency // ignore: cast_nullable_to_non_nullable
as String,interval: null == interval ? _self.interval : interval // ignore: cast_nullable_to_non_nullable
as int,weekdays: null == weekdays ? _self.weekdays : weekdays // ignore: cast_nullable_to_non_nullable
as List<int>,
  ));
}

}


/// Adds pattern-matching-related methods to [RepeatRuleDto].
extension RepeatRuleDtoPatterns on RepeatRuleDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RepeatRuleDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RepeatRuleDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RepeatRuleDto value)  $default,){
final _that = this;
switch (_that) {
case _RepeatRuleDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RepeatRuleDto value)?  $default,){
final _that = this;
switch (_that) {
case _RepeatRuleDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String frequency,  int interval,  List<int> weekdays)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RepeatRuleDto() when $default != null:
return $default(_that.frequency,_that.interval,_that.weekdays);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String frequency,  int interval,  List<int> weekdays)  $default,) {final _that = this;
switch (_that) {
case _RepeatRuleDto():
return $default(_that.frequency,_that.interval,_that.weekdays);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String frequency,  int interval,  List<int> weekdays)?  $default,) {final _that = this;
switch (_that) {
case _RepeatRuleDto() when $default != null:
return $default(_that.frequency,_that.interval,_that.weekdays);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _RepeatRuleDto implements RepeatRuleDto {
  const _RepeatRuleDto({required this.frequency, this.interval = 1, final  List<int> weekdays = const <int>[]}): _weekdays = weekdays;
  factory _RepeatRuleDto.fromJson(Map<String, dynamic> json) => _$RepeatRuleDtoFromJson(json);

@override final  String frequency;
// none|daily|weekly|monthly|custom
@override@JsonKey() final  int interval;
 final  List<int> _weekdays;
@override@JsonKey() List<int> get weekdays {
  if (_weekdays is EqualUnmodifiableListView) return _weekdays;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_weekdays);
}


/// Create a copy of RepeatRuleDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RepeatRuleDtoCopyWith<_RepeatRuleDto> get copyWith => __$RepeatRuleDtoCopyWithImpl<_RepeatRuleDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RepeatRuleDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RepeatRuleDto&&(identical(other.frequency, frequency) || other.frequency == frequency)&&(identical(other.interval, interval) || other.interval == interval)&&const DeepCollectionEquality().equals(other._weekdays, _weekdays));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,frequency,interval,const DeepCollectionEquality().hash(_weekdays));

@override
String toString() {
  return 'RepeatRuleDto(frequency: $frequency, interval: $interval, weekdays: $weekdays)';
}


}

/// @nodoc
abstract mixin class _$RepeatRuleDtoCopyWith<$Res> implements $RepeatRuleDtoCopyWith<$Res> {
  factory _$RepeatRuleDtoCopyWith(_RepeatRuleDto value, $Res Function(_RepeatRuleDto) _then) = __$RepeatRuleDtoCopyWithImpl;
@override @useResult
$Res call({
 String frequency, int interval, List<int> weekdays
});




}
/// @nodoc
class __$RepeatRuleDtoCopyWithImpl<$Res>
    implements _$RepeatRuleDtoCopyWith<$Res> {
  __$RepeatRuleDtoCopyWithImpl(this._self, this._then);

  final _RepeatRuleDto _self;
  final $Res Function(_RepeatRuleDto) _then;

/// Create a copy of RepeatRuleDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? frequency = null,Object? interval = null,Object? weekdays = null,}) {
  return _then(_RepeatRuleDto(
frequency: null == frequency ? _self.frequency : frequency // ignore: cast_nullable_to_non_nullable
as String,interval: null == interval ? _self.interval : interval // ignore: cast_nullable_to_non_nullable
as int,weekdays: null == weekdays ? _self._weekdays : weekdays // ignore: cast_nullable_to_non_nullable
as List<int>,
  ));
}


}


/// @nodoc
mixin _$TaskDto {

 String get id; String get title; String get tagId; DateTime get date; String? get timeOfDay;// morning|afternoon|evening|anytime
 DateTime? get startTime; int? get durationMin; RepeatRuleDto? get repeat; List<SubtaskDto> get subtasks; bool get done;
/// Create a copy of TaskDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TaskDtoCopyWith<TaskDto> get copyWith => _$TaskDtoCopyWithImpl<TaskDto>(this as TaskDto, _$identity);

  /// Serializes this TaskDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TaskDto&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.tagId, tagId) || other.tagId == tagId)&&(identical(other.date, date) || other.date == date)&&(identical(other.timeOfDay, timeOfDay) || other.timeOfDay == timeOfDay)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.durationMin, durationMin) || other.durationMin == durationMin)&&(identical(other.repeat, repeat) || other.repeat == repeat)&&const DeepCollectionEquality().equals(other.subtasks, subtasks)&&(identical(other.done, done) || other.done == done));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,tagId,date,timeOfDay,startTime,durationMin,repeat,const DeepCollectionEquality().hash(subtasks),done);

@override
String toString() {
  return 'TaskDto(id: $id, title: $title, tagId: $tagId, date: $date, timeOfDay: $timeOfDay, startTime: $startTime, durationMin: $durationMin, repeat: $repeat, subtasks: $subtasks, done: $done)';
}


}

/// @nodoc
abstract mixin class $TaskDtoCopyWith<$Res>  {
  factory $TaskDtoCopyWith(TaskDto value, $Res Function(TaskDto) _then) = _$TaskDtoCopyWithImpl;
@useResult
$Res call({
 String id, String title, String tagId, DateTime date, String? timeOfDay, DateTime? startTime, int? durationMin, RepeatRuleDto? repeat, List<SubtaskDto> subtasks, bool done
});


$RepeatRuleDtoCopyWith<$Res>? get repeat;

}
/// @nodoc
class _$TaskDtoCopyWithImpl<$Res>
    implements $TaskDtoCopyWith<$Res> {
  _$TaskDtoCopyWithImpl(this._self, this._then);

  final TaskDto _self;
  final $Res Function(TaskDto) _then;

/// Create a copy of TaskDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? title = null,Object? tagId = null,Object? date = null,Object? timeOfDay = freezed,Object? startTime = freezed,Object? durationMin = freezed,Object? repeat = freezed,Object? subtasks = null,Object? done = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,tagId: null == tagId ? _self.tagId : tagId // ignore: cast_nullable_to_non_nullable
as String,date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as DateTime,timeOfDay: freezed == timeOfDay ? _self.timeOfDay : timeOfDay // ignore: cast_nullable_to_non_nullable
as String?,startTime: freezed == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as DateTime?,durationMin: freezed == durationMin ? _self.durationMin : durationMin // ignore: cast_nullable_to_non_nullable
as int?,repeat: freezed == repeat ? _self.repeat : repeat // ignore: cast_nullable_to_non_nullable
as RepeatRuleDto?,subtasks: null == subtasks ? _self.subtasks : subtasks // ignore: cast_nullable_to_non_nullable
as List<SubtaskDto>,done: null == done ? _self.done : done // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}
/// Create a copy of TaskDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RepeatRuleDtoCopyWith<$Res>? get repeat {
    if (_self.repeat == null) {
    return null;
  }

  return $RepeatRuleDtoCopyWith<$Res>(_self.repeat!, (value) {
    return _then(_self.copyWith(repeat: value));
  });
}
}


/// Adds pattern-matching-related methods to [TaskDto].
extension TaskDtoPatterns on TaskDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TaskDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TaskDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TaskDto value)  $default,){
final _that = this;
switch (_that) {
case _TaskDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TaskDto value)?  $default,){
final _that = this;
switch (_that) {
case _TaskDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String title,  String tagId,  DateTime date,  String? timeOfDay,  DateTime? startTime,  int? durationMin,  RepeatRuleDto? repeat,  List<SubtaskDto> subtasks,  bool done)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TaskDto() when $default != null:
return $default(_that.id,_that.title,_that.tagId,_that.date,_that.timeOfDay,_that.startTime,_that.durationMin,_that.repeat,_that.subtasks,_that.done);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String title,  String tagId,  DateTime date,  String? timeOfDay,  DateTime? startTime,  int? durationMin,  RepeatRuleDto? repeat,  List<SubtaskDto> subtasks,  bool done)  $default,) {final _that = this;
switch (_that) {
case _TaskDto():
return $default(_that.id,_that.title,_that.tagId,_that.date,_that.timeOfDay,_that.startTime,_that.durationMin,_that.repeat,_that.subtasks,_that.done);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String title,  String tagId,  DateTime date,  String? timeOfDay,  DateTime? startTime,  int? durationMin,  RepeatRuleDto? repeat,  List<SubtaskDto> subtasks,  bool done)?  $default,) {final _that = this;
switch (_that) {
case _TaskDto() when $default != null:
return $default(_that.id,_that.title,_that.tagId,_that.date,_that.timeOfDay,_that.startTime,_that.durationMin,_that.repeat,_that.subtasks,_that.done);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _TaskDto implements TaskDto {
  const _TaskDto({required this.id, required this.title, required this.tagId, required this.date, this.timeOfDay, this.startTime, this.durationMin, this.repeat, final  List<SubtaskDto> subtasks = const <SubtaskDto>[], this.done = false}): _subtasks = subtasks;
  factory _TaskDto.fromJson(Map<String, dynamic> json) => _$TaskDtoFromJson(json);

@override final  String id;
@override final  String title;
@override final  String tagId;
@override final  DateTime date;
@override final  String? timeOfDay;
// morning|afternoon|evening|anytime
@override final  DateTime? startTime;
@override final  int? durationMin;
@override final  RepeatRuleDto? repeat;
 final  List<SubtaskDto> _subtasks;
@override@JsonKey() List<SubtaskDto> get subtasks {
  if (_subtasks is EqualUnmodifiableListView) return _subtasks;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_subtasks);
}

@override@JsonKey() final  bool done;

/// Create a copy of TaskDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TaskDtoCopyWith<_TaskDto> get copyWith => __$TaskDtoCopyWithImpl<_TaskDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TaskDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _TaskDto&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.tagId, tagId) || other.tagId == tagId)&&(identical(other.date, date) || other.date == date)&&(identical(other.timeOfDay, timeOfDay) || other.timeOfDay == timeOfDay)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.durationMin, durationMin) || other.durationMin == durationMin)&&(identical(other.repeat, repeat) || other.repeat == repeat)&&const DeepCollectionEquality().equals(other._subtasks, _subtasks)&&(identical(other.done, done) || other.done == done));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,tagId,date,timeOfDay,startTime,durationMin,repeat,const DeepCollectionEquality().hash(_subtasks),done);

@override
String toString() {
  return 'TaskDto(id: $id, title: $title, tagId: $tagId, date: $date, timeOfDay: $timeOfDay, startTime: $startTime, durationMin: $durationMin, repeat: $repeat, subtasks: $subtasks, done: $done)';
}


}

/// @nodoc
abstract mixin class _$TaskDtoCopyWith<$Res> implements $TaskDtoCopyWith<$Res> {
  factory _$TaskDtoCopyWith(_TaskDto value, $Res Function(_TaskDto) _then) = __$TaskDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String title, String tagId, DateTime date, String? timeOfDay, DateTime? startTime, int? durationMin, RepeatRuleDto? repeat, List<SubtaskDto> subtasks, bool done
});


@override $RepeatRuleDtoCopyWith<$Res>? get repeat;

}
/// @nodoc
class __$TaskDtoCopyWithImpl<$Res>
    implements _$TaskDtoCopyWith<$Res> {
  __$TaskDtoCopyWithImpl(this._self, this._then);

  final _TaskDto _self;
  final $Res Function(_TaskDto) _then;

/// Create a copy of TaskDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? title = null,Object? tagId = null,Object? date = null,Object? timeOfDay = freezed,Object? startTime = freezed,Object? durationMin = freezed,Object? repeat = freezed,Object? subtasks = null,Object? done = null,}) {
  return _then(_TaskDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,tagId: null == tagId ? _self.tagId : tagId // ignore: cast_nullable_to_non_nullable
as String,date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as DateTime,timeOfDay: freezed == timeOfDay ? _self.timeOfDay : timeOfDay // ignore: cast_nullable_to_non_nullable
as String?,startTime: freezed == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as DateTime?,durationMin: freezed == durationMin ? _self.durationMin : durationMin // ignore: cast_nullable_to_non_nullable
as int?,repeat: freezed == repeat ? _self.repeat : repeat // ignore: cast_nullable_to_non_nullable
as RepeatRuleDto?,subtasks: null == subtasks ? _self._subtasks : subtasks // ignore: cast_nullable_to_non_nullable
as List<SubtaskDto>,done: null == done ? _self.done : done // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

/// Create a copy of TaskDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RepeatRuleDtoCopyWith<$Res>? get repeat {
    if (_self.repeat == null) {
    return null;
  }

  return $RepeatRuleDtoCopyWith<$Res>(_self.repeat!, (value) {
    return _then(_self.copyWith(repeat: value));
  });
}
}

// dart format on
