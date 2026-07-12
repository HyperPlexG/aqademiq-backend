// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'ada_message_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$AdaMessageDto {

 String get id; String get role;// user|ada
 String get text; DateTime? get createdAt;
/// Create a copy of AdaMessageDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AdaMessageDtoCopyWith<AdaMessageDto> get copyWith => _$AdaMessageDtoCopyWithImpl<AdaMessageDto>(this as AdaMessageDto, _$identity);

  /// Serializes this AdaMessageDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AdaMessageDto&&(identical(other.id, id) || other.id == id)&&(identical(other.role, role) || other.role == role)&&(identical(other.text, text) || other.text == text)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,role,text,createdAt);

@override
String toString() {
  return 'AdaMessageDto(id: $id, role: $role, text: $text, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class $AdaMessageDtoCopyWith<$Res>  {
  factory $AdaMessageDtoCopyWith(AdaMessageDto value, $Res Function(AdaMessageDto) _then) = _$AdaMessageDtoCopyWithImpl;
@useResult
$Res call({
 String id, String role, String text, DateTime? createdAt
});




}
/// @nodoc
class _$AdaMessageDtoCopyWithImpl<$Res>
    implements $AdaMessageDtoCopyWith<$Res> {
  _$AdaMessageDtoCopyWithImpl(this._self, this._then);

  final AdaMessageDto _self;
  final $Res Function(AdaMessageDto) _then;

/// Create a copy of AdaMessageDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? role = null,Object? text = null,Object? createdAt = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String,text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [AdaMessageDto].
extension AdaMessageDtoPatterns on AdaMessageDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AdaMessageDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AdaMessageDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AdaMessageDto value)  $default,){
final _that = this;
switch (_that) {
case _AdaMessageDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AdaMessageDto value)?  $default,){
final _that = this;
switch (_that) {
case _AdaMessageDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String role,  String text,  DateTime? createdAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AdaMessageDto() when $default != null:
return $default(_that.id,_that.role,_that.text,_that.createdAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String role,  String text,  DateTime? createdAt)  $default,) {final _that = this;
switch (_that) {
case _AdaMessageDto():
return $default(_that.id,_that.role,_that.text,_that.createdAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String role,  String text,  DateTime? createdAt)?  $default,) {final _that = this;
switch (_that) {
case _AdaMessageDto() when $default != null:
return $default(_that.id,_that.role,_that.text,_that.createdAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _AdaMessageDto implements AdaMessageDto {
  const _AdaMessageDto({required this.id, required this.role, required this.text, this.createdAt});
  factory _AdaMessageDto.fromJson(Map<String, dynamic> json) => _$AdaMessageDtoFromJson(json);

@override final  String id;
@override final  String role;
// user|ada
@override final  String text;
@override final  DateTime? createdAt;

/// Create a copy of AdaMessageDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AdaMessageDtoCopyWith<_AdaMessageDto> get copyWith => __$AdaMessageDtoCopyWithImpl<_AdaMessageDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AdaMessageDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AdaMessageDto&&(identical(other.id, id) || other.id == id)&&(identical(other.role, role) || other.role == role)&&(identical(other.text, text) || other.text == text)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,role,text,createdAt);

@override
String toString() {
  return 'AdaMessageDto(id: $id, role: $role, text: $text, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class _$AdaMessageDtoCopyWith<$Res> implements $AdaMessageDtoCopyWith<$Res> {
  factory _$AdaMessageDtoCopyWith(_AdaMessageDto value, $Res Function(_AdaMessageDto) _then) = __$AdaMessageDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String role, String text, DateTime? createdAt
});




}
/// @nodoc
class __$AdaMessageDtoCopyWithImpl<$Res>
    implements _$AdaMessageDtoCopyWith<$Res> {
  __$AdaMessageDtoCopyWithImpl(this._self, this._then);

  final _AdaMessageDto _self;
  final $Res Function(_AdaMessageDto) _then;

/// Create a copy of AdaMessageDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? role = null,Object? text = null,Object? createdAt = freezed,}) {
  return _then(_AdaMessageDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String,text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}

// dart format on
