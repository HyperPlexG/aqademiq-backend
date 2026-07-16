// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'subject_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SubjectTargetDto {

 String get kind;// gpa|percent
 double get value;
/// Create a copy of SubjectTargetDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SubjectTargetDtoCopyWith<SubjectTargetDto> get copyWith => _$SubjectTargetDtoCopyWithImpl<SubjectTargetDto>(this as SubjectTargetDto, _$identity);

  /// Serializes this SubjectTargetDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SubjectTargetDto&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.value, value) || other.value == value));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,kind,value);

@override
String toString() {
  return 'SubjectTargetDto(kind: $kind, value: $value)';
}


}

/// @nodoc
abstract mixin class $SubjectTargetDtoCopyWith<$Res>  {
  factory $SubjectTargetDtoCopyWith(SubjectTargetDto value, $Res Function(SubjectTargetDto) _then) = _$SubjectTargetDtoCopyWithImpl;
@useResult
$Res call({
 String kind, double value
});




}
/// @nodoc
class _$SubjectTargetDtoCopyWithImpl<$Res>
    implements $SubjectTargetDtoCopyWith<$Res> {
  _$SubjectTargetDtoCopyWithImpl(this._self, this._then);

  final SubjectTargetDto _self;
  final $Res Function(SubjectTargetDto) _then;

/// Create a copy of SubjectTargetDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? kind = null,Object? value = null,}) {
  return _then(_self.copyWith(
kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as String,value: null == value ? _self.value : value // ignore: cast_nullable_to_non_nullable
as double,
  ));
}

}


/// Adds pattern-matching-related methods to [SubjectTargetDto].
extension SubjectTargetDtoPatterns on SubjectTargetDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SubjectTargetDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SubjectTargetDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SubjectTargetDto value)  $default,){
final _that = this;
switch (_that) {
case _SubjectTargetDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SubjectTargetDto value)?  $default,){
final _that = this;
switch (_that) {
case _SubjectTargetDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String kind,  double value)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SubjectTargetDto() when $default != null:
return $default(_that.kind,_that.value);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String kind,  double value)  $default,) {final _that = this;
switch (_that) {
case _SubjectTargetDto():
return $default(_that.kind,_that.value);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String kind,  double value)?  $default,) {final _that = this;
switch (_that) {
case _SubjectTargetDto() when $default != null:
return $default(_that.kind,_that.value);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SubjectTargetDto implements SubjectTargetDto {
  const _SubjectTargetDto({required this.kind, required this.value});
  factory _SubjectTargetDto.fromJson(Map<String, dynamic> json) => _$SubjectTargetDtoFromJson(json);

@override final  String kind;
// gpa|percent
@override final  double value;

/// Create a copy of SubjectTargetDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SubjectTargetDtoCopyWith<_SubjectTargetDto> get copyWith => __$SubjectTargetDtoCopyWithImpl<_SubjectTargetDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SubjectTargetDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SubjectTargetDto&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.value, value) || other.value == value));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,kind,value);

@override
String toString() {
  return 'SubjectTargetDto(kind: $kind, value: $value)';
}


}

/// @nodoc
abstract mixin class _$SubjectTargetDtoCopyWith<$Res> implements $SubjectTargetDtoCopyWith<$Res> {
  factory _$SubjectTargetDtoCopyWith(_SubjectTargetDto value, $Res Function(_SubjectTargetDto) _then) = __$SubjectTargetDtoCopyWithImpl;
@override @useResult
$Res call({
 String kind, double value
});




}
/// @nodoc
class __$SubjectTargetDtoCopyWithImpl<$Res>
    implements _$SubjectTargetDtoCopyWith<$Res> {
  __$SubjectTargetDtoCopyWithImpl(this._self, this._then);

  final _SubjectTargetDto _self;
  final $Res Function(_SubjectTargetDto) _then;

/// Create a copy of SubjectTargetDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? kind = null,Object? value = null,}) {
  return _then(_SubjectTargetDto(
kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as String,value: null == value ? _self.value : value // ignore: cast_nullable_to_non_nullable
as double,
  ));
}


}


/// @nodoc
mixin _$SubjectFileDto {

 String get id; String get name; String? get kind; String? get sizeLabel; bool get important;
/// Create a copy of SubjectFileDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SubjectFileDtoCopyWith<SubjectFileDto> get copyWith => _$SubjectFileDtoCopyWithImpl<SubjectFileDto>(this as SubjectFileDto, _$identity);

  /// Serializes this SubjectFileDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SubjectFileDto&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.sizeLabel, sizeLabel) || other.sizeLabel == sizeLabel)&&(identical(other.important, important) || other.important == important));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,kind,sizeLabel,important);

@override
String toString() {
  return 'SubjectFileDto(id: $id, name: $name, kind: $kind, sizeLabel: $sizeLabel, important: $important)';
}


}

/// @nodoc
abstract mixin class $SubjectFileDtoCopyWith<$Res>  {
  factory $SubjectFileDtoCopyWith(SubjectFileDto value, $Res Function(SubjectFileDto) _then) = _$SubjectFileDtoCopyWithImpl;
@useResult
$Res call({
 String id, String name, String? kind, String? sizeLabel, bool important
});




}
/// @nodoc
class _$SubjectFileDtoCopyWithImpl<$Res>
    implements $SubjectFileDtoCopyWith<$Res> {
  _$SubjectFileDtoCopyWithImpl(this._self, this._then);

  final SubjectFileDto _self;
  final $Res Function(SubjectFileDto) _then;

/// Create a copy of SubjectFileDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? kind = freezed,Object? sizeLabel = freezed,Object? important = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,kind: freezed == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as String?,sizeLabel: freezed == sizeLabel ? _self.sizeLabel : sizeLabel // ignore: cast_nullable_to_non_nullable
as String?,important: null == important ? _self.important : important // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [SubjectFileDto].
extension SubjectFileDtoPatterns on SubjectFileDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SubjectFileDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SubjectFileDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SubjectFileDto value)  $default,){
final _that = this;
switch (_that) {
case _SubjectFileDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SubjectFileDto value)?  $default,){
final _that = this;
switch (_that) {
case _SubjectFileDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String? kind,  String? sizeLabel,  bool important)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SubjectFileDto() when $default != null:
return $default(_that.id,_that.name,_that.kind,_that.sizeLabel,_that.important);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String? kind,  String? sizeLabel,  bool important)  $default,) {final _that = this;
switch (_that) {
case _SubjectFileDto():
return $default(_that.id,_that.name,_that.kind,_that.sizeLabel,_that.important);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String? kind,  String? sizeLabel,  bool important)?  $default,) {final _that = this;
switch (_that) {
case _SubjectFileDto() when $default != null:
return $default(_that.id,_that.name,_that.kind,_that.sizeLabel,_that.important);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SubjectFileDto implements SubjectFileDto {
  const _SubjectFileDto({required this.id, required this.name, this.kind, this.sizeLabel, this.important = false});
  factory _SubjectFileDto.fromJson(Map<String, dynamic> json) => _$SubjectFileDtoFromJson(json);

@override final  String id;
@override final  String name;
@override final  String? kind;
@override final  String? sizeLabel;
@override@JsonKey() final  bool important;

/// Create a copy of SubjectFileDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SubjectFileDtoCopyWith<_SubjectFileDto> get copyWith => __$SubjectFileDtoCopyWithImpl<_SubjectFileDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SubjectFileDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SubjectFileDto&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.sizeLabel, sizeLabel) || other.sizeLabel == sizeLabel)&&(identical(other.important, important) || other.important == important));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,kind,sizeLabel,important);

@override
String toString() {
  return 'SubjectFileDto(id: $id, name: $name, kind: $kind, sizeLabel: $sizeLabel, important: $important)';
}


}

/// @nodoc
abstract mixin class _$SubjectFileDtoCopyWith<$Res> implements $SubjectFileDtoCopyWith<$Res> {
  factory _$SubjectFileDtoCopyWith(_SubjectFileDto value, $Res Function(_SubjectFileDto) _then) = __$SubjectFileDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String? kind, String? sizeLabel, bool important
});




}
/// @nodoc
class __$SubjectFileDtoCopyWithImpl<$Res>
    implements _$SubjectFileDtoCopyWith<$Res> {
  __$SubjectFileDtoCopyWithImpl(this._self, this._then);

  final _SubjectFileDto _self;
  final $Res Function(_SubjectFileDto) _then;

/// Create a copy of SubjectFileDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? kind = freezed,Object? sizeLabel = freezed,Object? important = null,}) {
  return _then(_SubjectFileDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,kind: freezed == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as String?,sizeLabel: freezed == sizeLabel ? _self.sizeLabel : sizeLabel // ignore: cast_nullable_to_non_nullable
as String?,important: null == important ? _self.important : important // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$SubjectDto {

 String get id; String get name; String get color; String get semesterId; String? get code; SubjectTargetDto? get target; String? get targetGrade; String? get professor; int? get credits; int? get mood; String? get nextLabel; double? get focusHours; int get fileCount; List<SubjectFileDto> get files;
/// Create a copy of SubjectDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SubjectDtoCopyWith<SubjectDto> get copyWith => _$SubjectDtoCopyWithImpl<SubjectDto>(this as SubjectDto, _$identity);

  /// Serializes this SubjectDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SubjectDto&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.color, color) || other.color == color)&&(identical(other.semesterId, semesterId) || other.semesterId == semesterId)&&(identical(other.code, code) || other.code == code)&&(identical(other.target, target) || other.target == target)&&(identical(other.targetGrade, targetGrade) || other.targetGrade == targetGrade)&&(identical(other.professor, professor) || other.professor == professor)&&(identical(other.credits, credits) || other.credits == credits)&&(identical(other.mood, mood) || other.mood == mood)&&(identical(other.nextLabel, nextLabel) || other.nextLabel == nextLabel)&&(identical(other.focusHours, focusHours) || other.focusHours == focusHours)&&(identical(other.fileCount, fileCount) || other.fileCount == fileCount)&&const DeepCollectionEquality().equals(other.files, files));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,color,semesterId,code,target,targetGrade,professor,credits,mood,nextLabel,focusHours,fileCount,const DeepCollectionEquality().hash(files));

@override
String toString() {
  return 'SubjectDto(id: $id, name: $name, color: $color, semesterId: $semesterId, code: $code, target: $target, targetGrade: $targetGrade, professor: $professor, credits: $credits, mood: $mood, nextLabel: $nextLabel, focusHours: $focusHours, fileCount: $fileCount, files: $files)';
}


}

/// @nodoc
abstract mixin class $SubjectDtoCopyWith<$Res>  {
  factory $SubjectDtoCopyWith(SubjectDto value, $Res Function(SubjectDto) _then) = _$SubjectDtoCopyWithImpl;
@useResult
$Res call({
 String id, String name, String color, String semesterId, String? code, SubjectTargetDto? target, String? targetGrade, String? professor, int? credits, int? mood, String? nextLabel, double? focusHours, int fileCount, List<SubjectFileDto> files
});


$SubjectTargetDtoCopyWith<$Res>? get target;

}
/// @nodoc
class _$SubjectDtoCopyWithImpl<$Res>
    implements $SubjectDtoCopyWith<$Res> {
  _$SubjectDtoCopyWithImpl(this._self, this._then);

  final SubjectDto _self;
  final $Res Function(SubjectDto) _then;

/// Create a copy of SubjectDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? color = null,Object? semesterId = null,Object? code = freezed,Object? target = freezed,Object? targetGrade = freezed,Object? professor = freezed,Object? credits = freezed,Object? mood = freezed,Object? nextLabel = freezed,Object? focusHours = freezed,Object? fileCount = null,Object? files = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,color: null == color ? _self.color : color // ignore: cast_nullable_to_non_nullable
as String,semesterId: null == semesterId ? _self.semesterId : semesterId // ignore: cast_nullable_to_non_nullable
as String,code: freezed == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String?,target: freezed == target ? _self.target : target // ignore: cast_nullable_to_non_nullable
as SubjectTargetDto?,targetGrade: freezed == targetGrade ? _self.targetGrade : targetGrade // ignore: cast_nullable_to_non_nullable
as String?,professor: freezed == professor ? _self.professor : professor // ignore: cast_nullable_to_non_nullable
as String?,credits: freezed == credits ? _self.credits : credits // ignore: cast_nullable_to_non_nullable
as int?,mood: freezed == mood ? _self.mood : mood // ignore: cast_nullable_to_non_nullable
as int?,nextLabel: freezed == nextLabel ? _self.nextLabel : nextLabel // ignore: cast_nullable_to_non_nullable
as String?,focusHours: freezed == focusHours ? _self.focusHours : focusHours // ignore: cast_nullable_to_non_nullable
as double?,fileCount: null == fileCount ? _self.fileCount : fileCount // ignore: cast_nullable_to_non_nullable
as int,files: null == files ? _self.files : files // ignore: cast_nullable_to_non_nullable
as List<SubjectFileDto>,
  ));
}
/// Create a copy of SubjectDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SubjectTargetDtoCopyWith<$Res>? get target {
    if (_self.target == null) {
    return null;
  }

  return $SubjectTargetDtoCopyWith<$Res>(_self.target!, (value) {
    return _then(_self.copyWith(target: value));
  });
}
}


/// Adds pattern-matching-related methods to [SubjectDto].
extension SubjectDtoPatterns on SubjectDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SubjectDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SubjectDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SubjectDto value)  $default,){
final _that = this;
switch (_that) {
case _SubjectDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SubjectDto value)?  $default,){
final _that = this;
switch (_that) {
case _SubjectDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String color,  String semesterId,  String? code,  SubjectTargetDto? target,  String? targetGrade,  String? professor,  int? credits,  int? mood,  String? nextLabel,  double? focusHours,  int fileCount,  List<SubjectFileDto> files)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SubjectDto() when $default != null:
return $default(_that.id,_that.name,_that.color,_that.semesterId,_that.code,_that.target,_that.targetGrade,_that.professor,_that.credits,_that.mood,_that.nextLabel,_that.focusHours,_that.fileCount,_that.files);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String color,  String semesterId,  String? code,  SubjectTargetDto? target,  String? targetGrade,  String? professor,  int? credits,  int? mood,  String? nextLabel,  double? focusHours,  int fileCount,  List<SubjectFileDto> files)  $default,) {final _that = this;
switch (_that) {
case _SubjectDto():
return $default(_that.id,_that.name,_that.color,_that.semesterId,_that.code,_that.target,_that.targetGrade,_that.professor,_that.credits,_that.mood,_that.nextLabel,_that.focusHours,_that.fileCount,_that.files);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String color,  String semesterId,  String? code,  SubjectTargetDto? target,  String? targetGrade,  String? professor,  int? credits,  int? mood,  String? nextLabel,  double? focusHours,  int fileCount,  List<SubjectFileDto> files)?  $default,) {final _that = this;
switch (_that) {
case _SubjectDto() when $default != null:
return $default(_that.id,_that.name,_that.color,_that.semesterId,_that.code,_that.target,_that.targetGrade,_that.professor,_that.credits,_that.mood,_that.nextLabel,_that.focusHours,_that.fileCount,_that.files);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SubjectDto implements SubjectDto {
  const _SubjectDto({required this.id, required this.name, required this.color, required this.semesterId, this.code, this.target, this.targetGrade, this.professor, this.credits, this.mood, this.nextLabel, this.focusHours, this.fileCount = 0, final  List<SubjectFileDto> files = const <SubjectFileDto>[]}): _files = files;
  factory _SubjectDto.fromJson(Map<String, dynamic> json) => _$SubjectDtoFromJson(json);

@override final  String id;
@override final  String name;
@override final  String color;
@override final  String semesterId;
@override final  String? code;
@override final  SubjectTargetDto? target;
@override final  String? targetGrade;
@override final  String? professor;
@override final  int? credits;
@override final  int? mood;
@override final  String? nextLabel;
@override final  double? focusHours;
@override@JsonKey() final  int fileCount;
 final  List<SubjectFileDto> _files;
@override@JsonKey() List<SubjectFileDto> get files {
  if (_files is EqualUnmodifiableListView) return _files;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_files);
}


/// Create a copy of SubjectDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SubjectDtoCopyWith<_SubjectDto> get copyWith => __$SubjectDtoCopyWithImpl<_SubjectDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SubjectDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SubjectDto&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.color, color) || other.color == color)&&(identical(other.semesterId, semesterId) || other.semesterId == semesterId)&&(identical(other.code, code) || other.code == code)&&(identical(other.target, target) || other.target == target)&&(identical(other.targetGrade, targetGrade) || other.targetGrade == targetGrade)&&(identical(other.professor, professor) || other.professor == professor)&&(identical(other.credits, credits) || other.credits == credits)&&(identical(other.mood, mood) || other.mood == mood)&&(identical(other.nextLabel, nextLabel) || other.nextLabel == nextLabel)&&(identical(other.focusHours, focusHours) || other.focusHours == focusHours)&&(identical(other.fileCount, fileCount) || other.fileCount == fileCount)&&const DeepCollectionEquality().equals(other._files, _files));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,color,semesterId,code,target,targetGrade,professor,credits,mood,nextLabel,focusHours,fileCount,const DeepCollectionEquality().hash(_files));

@override
String toString() {
  return 'SubjectDto(id: $id, name: $name, color: $color, semesterId: $semesterId, code: $code, target: $target, targetGrade: $targetGrade, professor: $professor, credits: $credits, mood: $mood, nextLabel: $nextLabel, focusHours: $focusHours, fileCount: $fileCount, files: $files)';
}


}

/// @nodoc
abstract mixin class _$SubjectDtoCopyWith<$Res> implements $SubjectDtoCopyWith<$Res> {
  factory _$SubjectDtoCopyWith(_SubjectDto value, $Res Function(_SubjectDto) _then) = __$SubjectDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String color, String semesterId, String? code, SubjectTargetDto? target, String? targetGrade, String? professor, int? credits, int? mood, String? nextLabel, double? focusHours, int fileCount, List<SubjectFileDto> files
});


@override $SubjectTargetDtoCopyWith<$Res>? get target;

}
/// @nodoc
class __$SubjectDtoCopyWithImpl<$Res>
    implements _$SubjectDtoCopyWith<$Res> {
  __$SubjectDtoCopyWithImpl(this._self, this._then);

  final _SubjectDto _self;
  final $Res Function(_SubjectDto) _then;

/// Create a copy of SubjectDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? color = null,Object? semesterId = null,Object? code = freezed,Object? target = freezed,Object? targetGrade = freezed,Object? professor = freezed,Object? credits = freezed,Object? mood = freezed,Object? nextLabel = freezed,Object? focusHours = freezed,Object? fileCount = null,Object? files = null,}) {
  return _then(_SubjectDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,color: null == color ? _self.color : color // ignore: cast_nullable_to_non_nullable
as String,semesterId: null == semesterId ? _self.semesterId : semesterId // ignore: cast_nullable_to_non_nullable
as String,code: freezed == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String?,target: freezed == target ? _self.target : target // ignore: cast_nullable_to_non_nullable
as SubjectTargetDto?,targetGrade: freezed == targetGrade ? _self.targetGrade : targetGrade // ignore: cast_nullable_to_non_nullable
as String?,professor: freezed == professor ? _self.professor : professor // ignore: cast_nullable_to_non_nullable
as String?,credits: freezed == credits ? _self.credits : credits // ignore: cast_nullable_to_non_nullable
as int?,mood: freezed == mood ? _self.mood : mood // ignore: cast_nullable_to_non_nullable
as int?,nextLabel: freezed == nextLabel ? _self.nextLabel : nextLabel // ignore: cast_nullable_to_non_nullable
as String?,focusHours: freezed == focusHours ? _self.focusHours : focusHours // ignore: cast_nullable_to_non_nullable
as double?,fileCount: null == fileCount ? _self.fileCount : fileCount // ignore: cast_nullable_to_non_nullable
as int,files: null == files ? _self._files : files // ignore: cast_nullable_to_non_nullable
as List<SubjectFileDto>,
  ));
}

/// Create a copy of SubjectDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SubjectTargetDtoCopyWith<$Res>? get target {
    if (_self.target == null) {
    return null;
  }

  return $SubjectTargetDtoCopyWith<$Res>(_self.target!, (value) {
    return _then(_self.copyWith(target: value));
  });
}
}


/// @nodoc
mixin _$SemesterDto {

 String get id; String get name;
/// Create a copy of SemesterDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SemesterDtoCopyWith<SemesterDto> get copyWith => _$SemesterDtoCopyWithImpl<SemesterDto>(this as SemesterDto, _$identity);

  /// Serializes this SemesterDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SemesterDto&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name);

@override
String toString() {
  return 'SemesterDto(id: $id, name: $name)';
}


}

/// @nodoc
abstract mixin class $SemesterDtoCopyWith<$Res>  {
  factory $SemesterDtoCopyWith(SemesterDto value, $Res Function(SemesterDto) _then) = _$SemesterDtoCopyWithImpl;
@useResult
$Res call({
 String id, String name
});




}
/// @nodoc
class _$SemesterDtoCopyWithImpl<$Res>
    implements $SemesterDtoCopyWith<$Res> {
  _$SemesterDtoCopyWithImpl(this._self, this._then);

  final SemesterDto _self;
  final $Res Function(SemesterDto) _then;

/// Create a copy of SemesterDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [SemesterDto].
extension SemesterDtoPatterns on SemesterDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SemesterDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SemesterDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SemesterDto value)  $default,){
final _that = this;
switch (_that) {
case _SemesterDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SemesterDto value)?  $default,){
final _that = this;
switch (_that) {
case _SemesterDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SemesterDto() when $default != null:
return $default(_that.id,_that.name);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name)  $default,) {final _that = this;
switch (_that) {
case _SemesterDto():
return $default(_that.id,_that.name);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name)?  $default,) {final _that = this;
switch (_that) {
case _SemesterDto() when $default != null:
return $default(_that.id,_that.name);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SemesterDto implements SemesterDto {
  const _SemesterDto({required this.id, required this.name});
  factory _SemesterDto.fromJson(Map<String, dynamic> json) => _$SemesterDtoFromJson(json);

@override final  String id;
@override final  String name;

/// Create a copy of SemesterDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SemesterDtoCopyWith<_SemesterDto> get copyWith => __$SemesterDtoCopyWithImpl<_SemesterDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SemesterDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SemesterDto&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name);

@override
String toString() {
  return 'SemesterDto(id: $id, name: $name)';
}


}

/// @nodoc
abstract mixin class _$SemesterDtoCopyWith<$Res> implements $SemesterDtoCopyWith<$Res> {
  factory _$SemesterDtoCopyWith(_SemesterDto value, $Res Function(_SemesterDto) _then) = __$SemesterDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String name
});




}
/// @nodoc
class __$SemesterDtoCopyWithImpl<$Res>
    implements _$SemesterDtoCopyWith<$Res> {
  __$SemesterDtoCopyWithImpl(this._self, this._then);

  final _SemesterDto _self;
  final $Res Function(_SemesterDto) _then;

/// Create a copy of SemesterDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,}) {
  return _then(_SemesterDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
