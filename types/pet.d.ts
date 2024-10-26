/* eslint-disable @typescript-eslint/no-unused-vars */
declare type Tinyint = number;
/** @field INT */
declare type Int<T = 8> = number;
/** @field 'INT UNSIGNED' */
declare type Uint<T> = number;
declare type Float = number;
declare type Double = number;
declare type Datetime = Date;
declare type Time = Date;
/** @field TIMESTAMP */
declare type Timestamp = Date;
declare type Char<T> = string;
declare type Varchar<T> = string;
declare type Enum = string;
declare type Union = string;
declare type Json = Record<string, any>;
