// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'subject.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$SubjectTarget {

 SubjectTargetKind get kind; double get value;
/// Create a copy of SubjectTarget
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SubjectTargetCopyWith<SubjectTarget> get copyWith => _$SubjectTargetCopyWithImpl<SubjectTarget>(this as SubjectTarget, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SubjectTarget&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.value, value) || other.value == value));
}


@override
int get hashCode => Object.hash(runtimeType,kind,value);

@override
String toString() {
  return 'SubjectTarget(kind: $kind, value: $value)';
}


}

/// @nodoc
abstract mixin class $SubjectTargetCopyWith<$Res>  {
  factory $SubjectTargetCopyWith(SubjectTarget value, $Res Function(SubjectTarget) _then) = _$SubjectTargetCopyWithImpl;
@useResult
$Res call({
 SubjectTargetKind kind, double value
});




}
/// @nodoc
class _$SubjectTargetCopyWithImpl<$Res>
    implements $SubjectTargetCopyWith<$Res> {
  _$SubjectTargetCopyWithImpl(this._self, this._then);

  final SubjectTarget _self;
  final $Res Function(SubjectTarget) _then;

/// Create a copy of SubjectTarget
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? kind = null,Object? value = null,}) {
  return _then(_self.copyWith(
kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as SubjectTargetKind,value: null == value ? _self.value : value // ignore: cast_nullable_to_non_nullable
as double,
  ));
}

}


/// Adds pattern-matching-related methods to [SubjectTarget].
extension SubjectTargetPatterns on SubjectTarget {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SubjectTarget value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SubjectTarget() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SubjectTarget value)  $default,){
final _that = this;
switch (_that) {
case _SubjectTarget():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SubjectTarget value)?  $default,){
final _that = this;
switch (_that) {
case _SubjectTarget() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( SubjectTargetKind kind,  double value)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SubjectTarget() when $default != null:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( SubjectTargetKind kind,  double value)  $default,) {final _that = this;
switch (_that) {
case _SubjectTarget():
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( SubjectTargetKind kind,  double value)?  $default,) {final _that = this;
switch (_that) {
case _SubjectTarget() when $default != null:
return $default(_that.kind,_that.value);case _:
  return null;

}
}

}

/// @nodoc


class _SubjectTarget implements SubjectTarget {
  const _SubjectTarget({required this.kind, required this.value});
  

@override final  SubjectTargetKind kind;
@override final  double value;

/// Create a copy of SubjectTarget
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SubjectTargetCopyWith<_SubjectTarget> get copyWith => __$SubjectTargetCopyWithImpl<_SubjectTarget>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SubjectTarget&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.value, value) || other.value == value));
}


@override
int get hashCode => Object.hash(runtimeType,kind,value);

@override
String toString() {
  return 'SubjectTarget(kind: $kind, value: $value)';
}


}

/// @nodoc
abstract mixin class _$SubjectTargetCopyWith<$Res> implements $SubjectTargetCopyWith<$Res> {
  factory _$SubjectTargetCopyWith(_SubjectTarget value, $Res Function(_SubjectTarget) _then) = __$SubjectTargetCopyWithImpl;
@override @useResult
$Res call({
 SubjectTargetKind kind, double value
});




}
/// @nodoc
class __$SubjectTargetCopyWithImpl<$Res>
    implements _$SubjectTargetCopyWith<$Res> {
  __$SubjectTargetCopyWithImpl(this._self, this._then);

  final _SubjectTarget _self;
  final $Res Function(_SubjectTarget) _then;

/// Create a copy of SubjectTarget
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? kind = null,Object? value = null,}) {
  return _then(_SubjectTarget(
kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as SubjectTargetKind,value: null == value ? _self.value : value // ignore: cast_nullable_to_non_nullable
as double,
  ));
}


}

/// @nodoc
mixin _$Subject {

 String get id; String get name; String get color;// hex string, e.g. "#6b5cf0"
 String get semesterId; String? get code;// e.g. "CC 401"
 SubjectTarget? get target; String? get targetGrade;// e.g. "A"
 String? get professor; int? get credits; int? get mood;// 0..4
 String? get nextLabel;// e.g. "Viva · 3 days"
 double? get focusHours;// this week
 int get fileCount;
/// Create a copy of Subject
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SubjectCopyWith<Subject> get copyWith => _$SubjectCopyWithImpl<Subject>(this as Subject, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Subject&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.color, color) || other.color == color)&&(identical(other.semesterId, semesterId) || other.semesterId == semesterId)&&(identical(other.code, code) || other.code == code)&&(identical(other.target, target) || other.target == target)&&(identical(other.targetGrade, targetGrade) || other.targetGrade == targetGrade)&&(identical(other.professor, professor) || other.professor == professor)&&(identical(other.credits, credits) || other.credits == credits)&&(identical(other.mood, mood) || other.mood == mood)&&(identical(other.nextLabel, nextLabel) || other.nextLabel == nextLabel)&&(identical(other.focusHours, focusHours) || other.focusHours == focusHours)&&(identical(other.fileCount, fileCount) || other.fileCount == fileCount));
}


@override
int get hashCode => Object.hash(runtimeType,id,name,color,semesterId,code,target,targetGrade,professor,credits,mood,nextLabel,focusHours,fileCount);

@override
String toString() {
  return 'Subject(id: $id, name: $name, color: $color, semesterId: $semesterId, code: $code, target: $target, targetGrade: $targetGrade, professor: $professor, credits: $credits, mood: $mood, nextLabel: $nextLabel, focusHours: $focusHours, fileCount: $fileCount)';
}


}

/// @nodoc
abstract mixin class $SubjectCopyWith<$Res>  {
  factory $SubjectCopyWith(Subject value, $Res Function(Subject) _then) = _$SubjectCopyWithImpl;
@useResult
$Res call({
 String id, String name, String color, String semesterId, String? code, SubjectTarget? target, String? targetGrade, String? professor, int? credits, int? mood, String? nextLabel, double? focusHours, int fileCount
});


$SubjectTargetCopyWith<$Res>? get target;

}
/// @nodoc
class _$SubjectCopyWithImpl<$Res>
    implements $SubjectCopyWith<$Res> {
  _$SubjectCopyWithImpl(this._self, this._then);

  final Subject _self;
  final $Res Function(Subject) _then;

/// Create a copy of Subject
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? color = null,Object? semesterId = null,Object? code = freezed,Object? target = freezed,Object? targetGrade = freezed,Object? professor = freezed,Object? credits = freezed,Object? mood = freezed,Object? nextLabel = freezed,Object? focusHours = freezed,Object? fileCount = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,color: null == color ? _self.color : color // ignore: cast_nullable_to_non_nullable
as String,semesterId: null == semesterId ? _self.semesterId : semesterId // ignore: cast_nullable_to_non_nullable
as String,code: freezed == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String?,target: freezed == target ? _self.target : target // ignore: cast_nullable_to_non_nullable
as SubjectTarget?,targetGrade: freezed == targetGrade ? _self.targetGrade : targetGrade // ignore: cast_nullable_to_non_nullable
as String?,professor: freezed == professor ? _self.professor : professor // ignore: cast_nullable_to_non_nullable
as String?,credits: freezed == credits ? _self.credits : credits // ignore: cast_nullable_to_non_nullable
as int?,mood: freezed == mood ? _self.mood : mood // ignore: cast_nullable_to_non_nullable
as int?,nextLabel: freezed == nextLabel ? _self.nextLabel : nextLabel // ignore: cast_nullable_to_non_nullable
as String?,focusHours: freezed == focusHours ? _self.focusHours : focusHours // ignore: cast_nullable_to_non_nullable
as double?,fileCount: null == fileCount ? _self.fileCount : fileCount // ignore: cast_nullable_to_non_nullable
as int,
  ));
}
/// Create a copy of Subject
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SubjectTargetCopyWith<$Res>? get target {
    if (_self.target == null) {
    return null;
  }

  return $SubjectTargetCopyWith<$Res>(_self.target!, (value) {
    return _then(_self.copyWith(target: value));
  });
}
}


/// Adds pattern-matching-related methods to [Subject].
extension SubjectPatterns on Subject {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Subject value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Subject() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Subject value)  $default,){
final _that = this;
switch (_that) {
case _Subject():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Subject value)?  $default,){
final _that = this;
switch (_that) {
case _Subject() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String color,  String semesterId,  String? code,  SubjectTarget? target,  String? targetGrade,  String? professor,  int? credits,  int? mood,  String? nextLabel,  double? focusHours,  int fileCount)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Subject() when $default != null:
return $default(_that.id,_that.name,_that.color,_that.semesterId,_that.code,_that.target,_that.targetGrade,_that.professor,_that.credits,_that.mood,_that.nextLabel,_that.focusHours,_that.fileCount);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String color,  String semesterId,  String? code,  SubjectTarget? target,  String? targetGrade,  String? professor,  int? credits,  int? mood,  String? nextLabel,  double? focusHours,  int fileCount)  $default,) {final _that = this;
switch (_that) {
case _Subject():
return $default(_that.id,_that.name,_that.color,_that.semesterId,_that.code,_that.target,_that.targetGrade,_that.professor,_that.credits,_that.mood,_that.nextLabel,_that.focusHours,_that.fileCount);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String color,  String semesterId,  String? code,  SubjectTarget? target,  String? targetGrade,  String? professor,  int? credits,  int? mood,  String? nextLabel,  double? focusHours,  int fileCount)?  $default,) {final _that = this;
switch (_that) {
case _Subject() when $default != null:
return $default(_that.id,_that.name,_that.color,_that.semesterId,_that.code,_that.target,_that.targetGrade,_that.professor,_that.credits,_that.mood,_that.nextLabel,_that.focusHours,_that.fileCount);case _:
  return null;

}
}

}

/// @nodoc


class _Subject implements Subject {
  const _Subject({required this.id, required this.name, required this.color, required this.semesterId, this.code, this.target, this.targetGrade, this.professor, this.credits, this.mood, this.nextLabel, this.focusHours, this.fileCount = 0});
  

@override final  String id;
@override final  String name;
@override final  String color;
// hex string, e.g. "#6b5cf0"
@override final  String semesterId;
@override final  String? code;
// e.g. "CC 401"
@override final  SubjectTarget? target;
@override final  String? targetGrade;
// e.g. "A"
@override final  String? professor;
@override final  int? credits;
@override final  int? mood;
// 0..4
@override final  String? nextLabel;
// e.g. "Viva · 3 days"
@override final  double? focusHours;
// this week
@override@JsonKey() final  int fileCount;

/// Create a copy of Subject
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SubjectCopyWith<_Subject> get copyWith => __$SubjectCopyWithImpl<_Subject>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Subject&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.color, color) || other.color == color)&&(identical(other.semesterId, semesterId) || other.semesterId == semesterId)&&(identical(other.code, code) || other.code == code)&&(identical(other.target, target) || other.target == target)&&(identical(other.targetGrade, targetGrade) || other.targetGrade == targetGrade)&&(identical(other.professor, professor) || other.professor == professor)&&(identical(other.credits, credits) || other.credits == credits)&&(identical(other.mood, mood) || other.mood == mood)&&(identical(other.nextLabel, nextLabel) || other.nextLabel == nextLabel)&&(identical(other.focusHours, focusHours) || other.focusHours == focusHours)&&(identical(other.fileCount, fileCount) || other.fileCount == fileCount));
}


@override
int get hashCode => Object.hash(runtimeType,id,name,color,semesterId,code,target,targetGrade,professor,credits,mood,nextLabel,focusHours,fileCount);

@override
String toString() {
  return 'Subject(id: $id, name: $name, color: $color, semesterId: $semesterId, code: $code, target: $target, targetGrade: $targetGrade, professor: $professor, credits: $credits, mood: $mood, nextLabel: $nextLabel, focusHours: $focusHours, fileCount: $fileCount)';
}


}

/// @nodoc
abstract mixin class _$SubjectCopyWith<$Res> implements $SubjectCopyWith<$Res> {
  factory _$SubjectCopyWith(_Subject value, $Res Function(_Subject) _then) = __$SubjectCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String color, String semesterId, String? code, SubjectTarget? target, String? targetGrade, String? professor, int? credits, int? mood, String? nextLabel, double? focusHours, int fileCount
});


@override $SubjectTargetCopyWith<$Res>? get target;

}
/// @nodoc
class __$SubjectCopyWithImpl<$Res>
    implements _$SubjectCopyWith<$Res> {
  __$SubjectCopyWithImpl(this._self, this._then);

  final _Subject _self;
  final $Res Function(_Subject) _then;

/// Create a copy of Subject
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? color = null,Object? semesterId = null,Object? code = freezed,Object? target = freezed,Object? targetGrade = freezed,Object? professor = freezed,Object? credits = freezed,Object? mood = freezed,Object? nextLabel = freezed,Object? focusHours = freezed,Object? fileCount = null,}) {
  return _then(_Subject(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,color: null == color ? _self.color : color // ignore: cast_nullable_to_non_nullable
as String,semesterId: null == semesterId ? _self.semesterId : semesterId // ignore: cast_nullable_to_non_nullable
as String,code: freezed == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String?,target: freezed == target ? _self.target : target // ignore: cast_nullable_to_non_nullable
as SubjectTarget?,targetGrade: freezed == targetGrade ? _self.targetGrade : targetGrade // ignore: cast_nullable_to_non_nullable
as String?,professor: freezed == professor ? _self.professor : professor // ignore: cast_nullable_to_non_nullable
as String?,credits: freezed == credits ? _self.credits : credits // ignore: cast_nullable_to_non_nullable
as int?,mood: freezed == mood ? _self.mood : mood // ignore: cast_nullable_to_non_nullable
as int?,nextLabel: freezed == nextLabel ? _self.nextLabel : nextLabel // ignore: cast_nullable_to_non_nullable
as String?,focusHours: freezed == focusHours ? _self.focusHours : focusHours // ignore: cast_nullable_to_non_nullable
as double?,fileCount: null == fileCount ? _self.fileCount : fileCount // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

/// Create a copy of Subject
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SubjectTargetCopyWith<$Res>? get target {
    if (_self.target == null) {
    return null;
  }

  return $SubjectTargetCopyWith<$Res>(_self.target!, (value) {
    return _then(_self.copyWith(target: value));
  });
}
}

/// @nodoc
mixin _$Semester {

 String get id; String get name;
/// Create a copy of Semester
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SemesterCopyWith<Semester> get copyWith => _$SemesterCopyWithImpl<Semester>(this as Semester, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Semester&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name));
}


@override
int get hashCode => Object.hash(runtimeType,id,name);

@override
String toString() {
  return 'Semester(id: $id, name: $name)';
}


}

/// @nodoc
abstract mixin class $SemesterCopyWith<$Res>  {
  factory $SemesterCopyWith(Semester value, $Res Function(Semester) _then) = _$SemesterCopyWithImpl;
@useResult
$Res call({
 String id, String name
});




}
/// @nodoc
class _$SemesterCopyWithImpl<$Res>
    implements $SemesterCopyWith<$Res> {
  _$SemesterCopyWithImpl(this._self, this._then);

  final Semester _self;
  final $Res Function(Semester) _then;

/// Create a copy of Semester
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [Semester].
extension SemesterPatterns on Semester {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Semester value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Semester() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Semester value)  $default,){
final _that = this;
switch (_that) {
case _Semester():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Semester value)?  $default,){
final _that = this;
switch (_that) {
case _Semester() when $default != null:
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
case _Semester() when $default != null:
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
case _Semester():
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
case _Semester() when $default != null:
return $default(_that.id,_that.name);case _:
  return null;

}
}

}

/// @nodoc


class _Semester implements Semester {
  const _Semester({required this.id, required this.name});
  

@override final  String id;
@override final  String name;

/// Create a copy of Semester
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SemesterCopyWith<_Semester> get copyWith => __$SemesterCopyWithImpl<_Semester>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Semester&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name));
}


@override
int get hashCode => Object.hash(runtimeType,id,name);

@override
String toString() {
  return 'Semester(id: $id, name: $name)';
}


}

/// @nodoc
abstract mixin class _$SemesterCopyWith<$Res> implements $SemesterCopyWith<$Res> {
  factory _$SemesterCopyWith(_Semester value, $Res Function(_Semester) _then) = __$SemesterCopyWithImpl;
@override @useResult
$Res call({
 String id, String name
});




}
/// @nodoc
class __$SemesterCopyWithImpl<$Res>
    implements _$SemesterCopyWith<$Res> {
  __$SemesterCopyWithImpl(this._self, this._then);

  final _Semester _self;
  final $Res Function(_Semester) _then;

/// Create a copy of Semester
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,}) {
  return _then(_Semester(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
