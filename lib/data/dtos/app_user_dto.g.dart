// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_user_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_AppUserDto _$AppUserDtoFromJson(Map<String, dynamic> json) => _AppUserDto(
  id: json['id'] as String,
  name: json['name'] as String,
  email: json['email'] as String?,
  university: json['university'] as String?,
  program: json['program'] as String?,
  gender: json['gender'] as String?,
  avatarUrl: json['avatarUrl'] as String?,
  isGuest: json['isGuest'] as bool? ?? true,
);

Map<String, dynamic> _$AppUserDtoToJson(_AppUserDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'email': instance.email,
      'university': instance.university,
      'program': instance.program,
      'gender': instance.gender,
      'avatarUrl': instance.avatarUrl,
      'isGuest': instance.isGuest,
    };
