// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ada_message_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_AdaMessageDto _$AdaMessageDtoFromJson(Map<String, dynamic> json) =>
    _AdaMessageDto(
      id: json['id'] as String,
      role: json['role'] as String,
      text: json['text'] as String,
      createdAt: json['createdAt'] == null
          ? null
          : DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$AdaMessageDtoToJson(_AdaMessageDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'role': instance.role,
      'text': instance.text,
      'createdAt': instance.createdAt?.toIso8601String(),
    };
