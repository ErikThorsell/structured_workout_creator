import type { Workout } from '../types/workout';
import { flattenItems, type FitStep } from './flatten';

const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401,
  0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
];

function crc16(data: Uint8Array, start = 0, end?: number): number {
  let crc = 0;
  const len = end ?? data.length;
  for (let i = start; i < len; i++) {
    const byte = data[i];
    let tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[byte & 0xf];
    tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[(byte >> 4) & 0xf];
  }
  return crc;
}

class FitWriter {
  private buf: number[] = [];

  writeUint8(v: number): void {
    this.buf.push(v & 0xff);
  }

  writeUint16(v: number): void {
    this.buf.push(v & 0xff, (v >> 8) & 0xff);
  }

  writeUint32(v: number): void {
    this.buf.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);
  }

  writeString(s: string, size: number): void {
    const bytes = new TextEncoder().encode(s);
    for (let i = 0; i < size; i++) {
      this.buf.push(i < bytes.length ? bytes[i] : 0);
    }
  }

  get length(): number {
    return this.buf.length;
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}

function writeDefinition(
  w: FitWriter,
  localMsgType: number,
  globalMsgNum: number,
  fields: [number, number, number][], // [def_num, size, base_type]
): void {
  w.writeUint8(0x40 | localMsgType); // record header: definition
  w.writeUint8(0); // reserved
  w.writeUint8(0); // little-endian
  w.writeUint16(globalMsgNum);
  w.writeUint8(fields.length);
  for (const [defNum, size, baseType] of fields) {
    w.writeUint8(defNum);
    w.writeUint8(size);
    w.writeUint8(baseType);
  }
}

const NAME_SIZE = 24;
const NOTES_SIZE = 64;

export function encodeFitWorkout(workout: Workout): Uint8Array {
  const steps = flattenItems(workout.items);
  const workoutName = workout.name.slice(0, 40);

  const data = new FitWriter();

  // -- file_id definition (global message 0, local 0) --
  writeDefinition(data, 0, 0, [
    [0, 1, 0x00], // type (enum)
    [1, 2, 0x84], // manufacturer (uint16)
    [4, 4, 0x86], // time_created (uint32)
    [3, 4, 0x8c], // serial_number (uint32z)
  ]);

  // -- file_id data --
  data.writeUint8(0); // record header: data, local 0
  data.writeUint8(5); // type = workout
  data.writeUint16(1); // manufacturer = 1 (garmin)
  data.writeUint32(Math.floor(Date.now() / 1000) - 631065600); // garmin timestamp
  data.writeUint32(12345); // serial number

  // -- workout definition (global message 26, local 1) --
  const workoutNameSize = workoutName.length + 1;
  writeDefinition(data, 1, 26, [
    [4, 1, 0x00], // sport (enum)
    [6, 2, 0x84], // num_valid_steps (uint16)
    [8, workoutNameSize, 0x07], // wkt_name (string)
  ]);

  // -- workout data --
  data.writeUint8(1); // record header: data, local 1
  data.writeUint8(2); // sport = cycling
  data.writeUint16(steps.length);
  data.writeString(workoutName, workoutNameSize);

  // -- workout_step definition (global message 27, local 2) --
  writeDefinition(data, 2, 27, [
    [254, 2, 0x84], // message_index (uint16)
    [0, NAME_SIZE, 0x07], // wkt_step_name (string)
    [1, 1, 0x00], // duration_type (enum)
    [2, 4, 0x86], // duration_value (uint32)
    [3, 1, 0x00], // target_type (enum)
    [4, 4, 0x86], // target_value (uint32)
    [5, 4, 0x86], // custom_target_value_low (uint32)
    [6, 4, 0x86], // custom_target_value_high (uint32)
    [7, 1, 0x00], // intensity (enum)
    [8, NOTES_SIZE, 0x07], // notes (string)
  ]);

  // -- workout_step data records --
  for (const step of steps) {
    data.writeUint8(2); // record header: data, local 2
    data.writeUint16(step.messageIndex);
    data.writeString(step.name, NAME_SIZE);
    data.writeUint8(step.durationType);
    data.writeUint32(step.durationValue);
    data.writeUint8(step.targetType);
    data.writeUint32(step.targetValue);
    data.writeUint32(step.customTargetLow);
    data.writeUint32(step.customTargetHigh);
    data.writeUint8(step.intensity);
    data.writeString(step.notes, NOTES_SIZE);
  }

  const dataBytes = data.toUint8Array();
  const dataSize = dataBytes.length;

  // -- build complete file: header + data + file CRC --
  const file = new FitWriter();

  // header (14 bytes)
  file.writeUint8(14); // header_size
  file.writeUint8(0x20); // protocol_version 2.0
  file.writeUint16(2182); // profile_version
  file.writeUint32(dataSize); // data_size
  file.writeUint8(0x2e); // '.'
  file.writeUint8(0x46); // 'F'
  file.writeUint8(0x49); // 'I'
  file.writeUint8(0x54); // 'T'

  // header CRC
  const headerBytes = file.toUint8Array();
  const headerCrc = crc16(headerBytes, 0, 12);
  file.writeUint16(headerCrc);

  // append data
  for (let i = 0; i < dataBytes.length; i++) {
    file.writeUint8(dataBytes[i]);
  }

  // file CRC (over header + data)
  const allBytes = file.toUint8Array();
  const fileCrc = crc16(allBytes);
  file.writeUint16(fileCrc);

  return file.toUint8Array();
}

export function downloadFitFile(workout: Workout): void {
  const data = encodeFitWorkout(workout);
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${workout.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.fit`;
  a.click();
  URL.revokeObjectURL(url);
}

export { type FitStep };
