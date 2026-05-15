<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ChatHistory extends Model
{
    use HasFactory;

    protected $fillable = [
        'question',
        'sql_query',
        'row_count',
        'status',
        'error_msg',
    ];
}