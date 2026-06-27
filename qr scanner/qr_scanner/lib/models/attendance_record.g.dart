// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'attendance_record.dart';

// **************************************************************************
// TypeAdapterGenerator
// **************************************************************************

class AttendanceRecordAdapter extends TypeAdapter<AttendanceRecord> {
  @override
  final int typeId = 0;

  @override
  AttendanceRecord read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return AttendanceRecord(
      id: fields[0] as String,
      studentId: fields[1] as String,
      scanDateTime: fields[2] as DateTime,
      eventName: fields[3] as String,
      adminId: fields[4] as String,
      isSynced: fields[5] as bool,
      syncedAt: fields[6] as DateTime?,
      notes: fields[7] as String?,
      studentName: fields[8] as String?,
      schoolName: fields[9] as String?,
      programName: fields[10] as String?,
    );
  }

  @override
  void write(BinaryWriter writer, AttendanceRecord obj) {
    writer
      ..writeByte(11)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.studentId)
      ..writeByte(2)
      ..write(obj.scanDateTime)
      ..writeByte(3)
      ..write(obj.eventName)
      ..writeByte(4)
      ..write(obj.adminId)
      ..writeByte(5)
      ..write(obj.isSynced)
      ..writeByte(6)
      ..write(obj.syncedAt)
      ..writeByte(7)
      ..write(obj.notes)
      ..writeByte(8)
      ..write(obj.studentName)
      ..writeByte(9)
      ..write(obj.schoolName)
      ..writeByte(10)
      ..write(obj.programName);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AttendanceRecordAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}
