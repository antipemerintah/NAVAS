<?php
dd(DB::select("SELECT name FROM sqlite_master WHERE type='table'"));