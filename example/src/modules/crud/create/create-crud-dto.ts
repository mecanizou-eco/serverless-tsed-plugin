import {Default, Format, Maximum, MaxLength, Minimum, MinLength, Pattern, Required} from "@tsed/schema";

export class CreateCrudResponseDto {
    @MinLength(3)
    @MaxLength(50)
    indexed!: string
}

export class CreateCrudRequestDto {
    @Required()
    unique!: string

    @MinLength(3)
    @MaxLength(50)
    indexed!: string

    @Minimum(0)
    @Maximum(100)
    @Default(0)
    rate: number = 0

    @Pattern(/[a-z]/)
    pattern!: string

    @Format('date-time')
    @Default(Date.now)
    dateCreation: Date = new Date()
}